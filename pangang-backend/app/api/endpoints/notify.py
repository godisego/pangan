import os
from typing import Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.services.battle_commander import battle_commander
from app.services.notification_service import notification_service
from app.services.stock_service import stock_service


router = APIRouter()


def verify_trigger_secret(trigger_secret: Optional[str]) -> None:
    expected_secret = (os.getenv("DAILY_REPORT_TRIGGER_SECRET") or "").strip()
    if not expected_secret:
        return
    if trigger_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid trigger secret")


def ensure_public_notify_config_enabled() -> None:
    allow_write = (os.getenv("ALLOW_PUBLIC_NOTIFY_CONFIG", "true") or "true").lower() == "true"
    if not allow_write:
        raise HTTPException(status_code=403, detail="Remote notification config is disabled for this deployment")


def ensure_public_notify_test_enabled() -> None:
    allow_test = (os.getenv("ALLOW_PUBLIC_NOTIFY_TEST", "true") or "true").lower() == "true"
    if not allow_test:
        raise HTTPException(status_code=403, detail="Remote notification testing is disabled for this deployment")


class ChannelConfig(BaseModel):
    feishu_webhook: str = ""
    wecom_webhook: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_api_base: str = "https://api.telegram.org"
    telegram_proxy_url: str = ""


class ScheduleConfig(BaseModel):
    enabled: bool = False
    daily_time: str = "08:00"
    timezone: str = "Asia/Shanghai"


class NotifyConfigRequest(BaseModel):
    channels: ChannelConfig
    schedule: ScheduleConfig


class PushRequest(BaseModel):
    title: str
    content: str
    channels: Optional[List[str]] = None
    config: Optional[ChannelConfig] = None


class DailyReportRequest(BaseModel):
    channels: Optional[List[str]] = None
    config: Optional[ChannelConfig] = None


@router.get("/config")
async def get_config():
    return notification_service.get_config(masked=True)


@router.post("/config")
async def save_config(req: NotifyConfigRequest):
    ensure_public_notify_config_enabled()
    payload = {
        "channels": req.channels.model_dump() if hasattr(req.channels, "model_dump") else req.channels.dict(),
        "schedule": req.schedule.model_dump() if hasattr(req.schedule, "model_dump") else req.schedule.dict(),
    }
    success = notification_service.save_config(payload)
    return {
        "status": "success" if success else "error",
        "config": notification_service.get_config(masked=True),
    }


@router.post("/test")
async def test_push(req: PushRequest):
    ensure_public_notify_test_enabled()
    overrides = None
    if req.config:
        overrides = req.config.model_dump() if hasattr(req.config, "model_dump") else req.config.dict()
    return notification_service.send_broadcast(req.title, req.content, channels=req.channels, overrides=overrides)


def build_daily_report_message() -> Dict[str, str]:
    market = stock_service.get_market_indices()
    if not market:
        return {"error": "Failed to fetch market data"}

    summary = battle_commander.generate_commander_summary()
    context = {
        "market_clock": summary.get("timestamp", "")[:16].replace("T", " ") or "09:25",
        "label": summary.get("phase_label", "开盘作战"),
        "action_now": summary.get("action_now", "等待下一步指令"),
    }
    weather = summary.get("weather", {})
    review = summary.get("review", {})
    mainlines = summary.get("mainlines", {})
    stock_pool = summary.get("recommended_stocks", {})
    commander = {
        "position_text": summary.get("position_text", "观望"),
        "risk_flags": [],
        "time_orders": [],
        "focus": summary.get("focus", ""),
    }

    market_clock = context.get("market_clock", "09:25")
    phase_label = context.get("label", "开盘作战")
    weather_icon = weather.get("icon", "🪖")
    title = f"{weather_icon} A股首席战役指挥官 | {market_clock} {phase_label}"

    index_text = (
        f"上证指数 {market.get('index', {}).get('value', '—')} "
        f"({market.get('index', {}).get('change', '—')}%) | "
        f"成交 {market.get('volume', '—')} 亿 | "
        f"赚钱效应 {market.get('breadth', '—')}%"
    )

    frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")

    content_parts = [
        "## 【Role: A股首席战役指挥官】",
        f"当前时间：{market_clock} ({phase_label})",
        "任务目标：结合隔夜重磅新闻与今日竞价/盘面强度，生成开盘作战指令。",
        f"指数环境：{index_text}",
        "",
        _format_weather_section(weather),
        _format_review_section(review),
        _format_mainline_section(mainlines),
        _format_stock_pool_section(stock_pool),
        _format_commander_section(commander, context),
        f"[点击进入盘感总控台]({frontend_url})",
    ]

    return {"title": title, "content": "\n".join(part for part in content_parts if part is not None)}


def _format_weather_section(weather: Dict[str, str]) -> str:
    auction_data = weather.get("auction_data", {}) or {}
    limit_up = auction_data.get("limit_up", "—")
    red_ratio = auction_data.get("red_ratio", "—")
    summary_line = (
        f"{weather.get('icon', '🌤️')} 竞价情绪：{weather.get('weather', '未知')} "
        f"(竞价涨停 {limit_up} 家，开盘红盘率 {red_ratio}%)"
    )
    stale_note = "当前为降级快照，竞价细节未完整返回。" if weather.get("stale") else "外盘与竞价只做辅助，主判断仍看新闻主线能否转化为成交。"
    return (
        "### 🌤️【战场天气 (竞价感知)】\n"
        f"- {summary_line}\n"
        f"- 天气判断：{weather.get('description', '等待盘面确认')}\n"
        f"- 盘前备注：{stale_note}"
    )


def _format_review_section(review: Dict[str, str]) -> str:
    return (
        "### 🔄【昨日复盘 (闭环)】\n"
        f"- 昨日逻辑结论：{review.get('status', '暂无复盘结果')}\n"
        f"- 简评：{review.get('summary', '暂无昨日验证记录')}\n"
        f"- 命中率：{review.get('accuracy', 'N/A')}"
    )


def _format_mainline_section(mainlines: Dict[str, Dict[str, str]]) -> str:
    logic_a = mainlines.get("logic_a", {}) or {}
    logic_b = mainlines.get("logic_b", {}) or {}
    return (
        "### 🦋【今日两条主线】\n"
        f"{_format_logic_block('A / 进攻', logic_a)}\n"
        f"{_format_logic_block('B / 防守', logic_b)}"
    )


def _format_logic_block(label: str, logic: Dict[str, str]) -> str:
    source = logic.get("reason", "暂无清晰催化")
    if logic.get("us_mapping"):
        source = f"{source} | 催化映射：{logic.get('us_mapping')}"
    return (
        f"- **逻辑 {label}：{logic.get('name', '待定')}**\n"
        f"  - 逻辑来源：{source}\n"
        f"  - 📅 有效期：{logic.get('validity', '1 日')}\n"
        f"  - 🔑 验证点：{logic.get('verify_point', '观察量能与前排强度')}\n"
        f"  - ⚠️ 证伪信号：{logic.get('fake_signal', '一旦冲高回落且成交萎缩就撤')}"
    )


def _format_stock_pool_section(stock_pool: Dict[str, List[Dict[str, str]]]) -> str:
    attack_lines = _format_stock_bucket("逻辑 A / 进攻池", stock_pool.get("attack", []))
    defense_lines = _format_stock_bucket("逻辑 B / 防守池", stock_pool.get("defense", []))
    return f"### ⚔️【精锐股票池】\n{attack_lines}\n{defense_lines}"


def _format_stock_bucket(title: str, stocks: List[Dict[str, str]]) -> str:
    if not stocks:
        return f"- **{title}**：暂无可执行标的"

    lines = [
        f"- **{title}**",
        "  - 优先级 | 股票 | 开盘价预期 | 竞价状态 | 战术 (开盘后执行)",
        "  - --- | --- | --- | --- | ---",
    ]
    for item in stocks[:3]:
        lines.append(
            "  - "
            f"{item.get('priority', '观察')} | "
            f"{item.get('stock', '未知标的')} | "
            f"{item.get('auction_price', '待观察')} | "
            f"{item.get('auction_status', '待确认')} | "
            f"{item.get('tactic', '等待确认后执行')}"
        )
    return "\n".join(lines)


def _format_commander_section(commander: Dict[str, Dict[str, str]], context: Dict[str, str]) -> str:
    time_orders = commander.get("time_orders", []) or []
    if time_orders:
        order_lines = [
            f"  - {item.get('time', '--')} 前：若 {_strip_condition_prefix(item.get('condition', '条件未定义'))}，则 {item.get('action', '执行计划未定义')}"
            for item in time_orders[:3]
        ]
    else:
        order_lines = ["  - 暂无具体时间军令，先控制仓位，等主线确认。"]

    risk_flags = commander.get("risk_flags", []) or []
    risk_text = "；".join(risk_flags[:2]) if risk_flags else "弱线不恋战，强线不追高。"

    return (
        "### 📡【指挥官锦囊 (09:30-10:00)】\n"
        f"- 当前阶段：{context.get('label', '未知阶段')} | {context.get('action_now', '等待下一步指令')}\n"
        f"- 💰 仓位军令：{commander.get('position_text', '观望')}\n"
        f"- 风险提示：{risk_text}\n"
        "- ⏱️ 开盘特令：\n"
        + "\n".join(order_lines)
    )


def _strip_condition_prefix(condition: str) -> str:
    text = condition or "条件未定义"
    if text.startswith("若 "):
        return text[2:]
    if text.startswith("若"):
        return text[1:]
    return text


async def send_daily_report_now(
    channels: Optional[List[str]] = None,
    config_override: Optional[Dict[str, str]] = None,
):
    payload = build_daily_report_message()
    if payload.get("error"):
        return {"status": "error", "message": payload["error"]}
    return notification_service.send_broadcast(
        payload["title"],
        payload["content"],
        channels=channels,
        overrides=config_override,
    )


@router.post("/daily_report")
async def trigger_daily_report(
    req: Optional[DailyReportRequest] = None,
    x_trigger_secret: Optional[str] = Header(default=None),
):
    verify_trigger_secret(x_trigger_secret)
    overrides = None
    if req and req.config:
        overrides = req.config.model_dump() if hasattr(req.config, "model_dump") else req.config.dict()
    channels = req.channels if req else None
    return await send_daily_report_now(channels=channels, config_override=overrides)
