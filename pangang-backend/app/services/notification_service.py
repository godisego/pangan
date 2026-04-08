import json
import os
import re
import socket
from html import escape
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from ..core.state_store import state_store


DEFAULT_CONFIG: Dict[str, Any] = {
    "channels": {
        "feishu_webhook": "",
        "wecom_webhook": "",
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "telegram_api_base": "https://api.telegram.org",
        "telegram_proxy_url": "",
    },
    "schedule": {
        "enabled": False,
        "daily_time": "08:00",
        "timezone": "Asia/Shanghai",
        "last_sent_date": "",
    },
}


class NotificationService:
    def __init__(self):
        self.config_file = Path(__file__).resolve().parent.parent / "data" / "config.json"
        self.config = deepcopy(DEFAULT_CONFIG)
        self.store = state_store
        self._load_env_defaults()
        self.load_config()

    def _load_env_defaults(self):
        self.config["channels"]["feishu_webhook"] = os.getenv("FEISHU_WEBHOOK", "")
        self.config["channels"]["wecom_webhook"] = os.getenv("WECOM_WEBHOOK", "")
        self.config["channels"]["telegram_bot_token"] = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.config["channels"]["telegram_chat_id"] = os.getenv("TELEGRAM_CHAT_ID", "")
        self.config["channels"]["telegram_api_base"] = os.getenv("TELEGRAM_API_BASE", "https://api.telegram.org")
        self.config["channels"]["telegram_proxy_url"] = os.getenv("TELEGRAM_PROXY_URL", "")
        self.config["schedule"]["enabled"] = os.getenv("ENABLE_DAILY_SCHEDULER", "false").lower() == "true"
        self.config["schedule"]["daily_time"] = os.getenv("DAILY_PUSH_TIME", "08:00")
        self.config["schedule"]["timezone"] = os.getenv("DAILY_PUSH_TIMEZONE", "Asia/Shanghai")

    def load_config(self):
        try:
            db_config = self.store.get_json("system_config", "notification_config")
            if isinstance(db_config, dict):
                self.config["channels"].update(db_config.get("channels", {}))
                self.config["schedule"].update(db_config.get("schedule", {}))
                return
            if not self.config_file.exists():
                return
            data = json.loads(self.config_file.read_text())
            self.config["channels"].update(data.get("channels", {}))
            self.config["schedule"].update(data.get("schedule", {}))
            self.store.set_json("system_config", "notification_config", self.config)
        except Exception as exc:
            print(f"Error loading notification config: {exc}")

    def save_config(self, payload: Dict[str, Any]) -> bool:
        try:
            if payload.get("channels"):
                self.config["channels"].update(payload["channels"])
            if payload.get("schedule"):
                self.config["schedule"].update(payload["schedule"])
            self.store.set_json("system_config", "notification_config", self.config)
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            self.config_file.write_text(json.dumps(self.config, ensure_ascii=False, indent=2))
            return True
        except Exception as exc:
            print(f"Error saving notification config: {exc}")
            return False

    def get_config(self, masked: bool = False) -> Dict[str, Any]:
        config = deepcopy(self.config)
        if masked:
            config["channels"]["feishu_webhook"] = self._mask_secret(config["channels"].get("feishu_webhook", ""))
            config["channels"]["wecom_webhook"] = self._mask_secret(config["channels"].get("wecom_webhook", ""))
            config["channels"]["telegram_bot_token"] = self._mask_secret(config["channels"].get("telegram_bot_token", ""))
            config["channels"]["telegram_chat_id"] = self._mask_secret(config["channels"].get("telegram_chat_id", ""))
            config["channels"]["telegram_api_base"] = config["channels"].get("telegram_api_base", "https://api.telegram.org")
            config["channels"]["telegram_proxy_url"] = self._mask_secret(config["channels"].get("telegram_proxy_url", ""))
        config["available_channels"] = self.get_available_channels()
        return config

    def get_available_channels(self, overrides: Optional[Dict[str, Any]] = None) -> List[str]:
        channels = self._merged_channels(overrides)
        available = []
        if channels.get("feishu_webhook"):
            available.append("feishu")
        if channels.get("wecom_webhook"):
            available.append("wecom")
        if channels.get("telegram_bot_token") and channels.get("telegram_chat_id"):
            available.append("telegram")
        return available

    def should_send_daily(self, now: Optional[datetime] = None) -> bool:
        schedule = self.config.get("schedule", {})
        if not schedule.get("enabled"):
            return False
        if not self.get_available_channels():
            return False

        current = now or datetime.now()
        time_text = str(schedule.get("daily_time") or "08:00")
        try:
            hour, minute = [int(part) for part in time_text.split(":", 1)]
        except Exception:
            hour, minute = 8, 0

        if current.hour != hour or current.minute != minute:
            return False

        today = current.strftime("%Y-%m-%d")
        return schedule.get("last_sent_date") != today

    def mark_daily_sent(self, now: Optional[datetime] = None):
        current = now or datetime.now()
        self.config["schedule"]["last_sent_date"] = current.strftime("%Y-%m-%d")
        self.save_config({})

    def send_broadcast(
        self,
        title: str,
        content: str,
        channels: Optional[List[str]] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        merged_channels = self._merged_channels(overrides)
        selected_channels = channels or self.get_available_channels(overrides)
        if not selected_channels:
            return {"status": "error", "message": "No notification channels configured", "results": {}}

        results: Dict[str, Any] = {}
        success_count = 0

        for channel in selected_channels:
            if channel == "feishu":
                result = self._send_feishu(title, content, merged_channels.get("feishu_webhook", ""))
            elif channel == "wecom":
                result = self._send_wecom(title, content, merged_channels.get("wecom_webhook", ""))
            elif channel == "telegram":
                result = self._send_telegram(
                    title,
                    content,
                    merged_channels.get("telegram_bot_token", ""),
                    merged_channels.get("telegram_chat_id", ""),
                    merged_channels.get("telegram_api_base", "https://api.telegram.org"),
                    merged_channels.get("telegram_proxy_url", ""),
                )
            else:
                result = {"status": "error", "message": f"Unsupported channel: {channel}"}

            results[channel] = result
            if self._is_success(result, channel):
                success_count += 1

        if success_count == len(selected_channels):
            status = "success"
        elif success_count > 0:
            status = "partial"
        else:
            status = "error"

        return {
            "status": status,
            "sent": success_count,
            "total": len(selected_channels),
            "results": results,
        }

    def _merged_channels(self, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        merged = deepcopy(self.config["channels"])
        if overrides:
            merged.update({key: value for key, value in overrides.items() if value is not None})
        return merged

    def _send_feishu(self, title: str, content: str, webhook_url: str) -> Dict[str, Any]:
        if not webhook_url:
            return {"status": "error", "message": "No Feishu webhook URL provided"}

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {"tag": "plain_text", "content": title},
                    "template": "blue",
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {"tag": "lark_md", "content": content},
                    },
                    {
                        "tag": "note",
                        "elements": [
                            {
                                "tag": "plain_text",
                                "content": f"发布时间: {timestamp} | 来自: 盘感AI",
                            }
                        ],
                    },
                ],
            },
        }
        try:
            response = requests.post(webhook_url, json=payload, timeout=8)
            return response.json()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    def _send_wecom(self, title: str, content: str, webhook_url: str) -> Dict[str, Any]:
        if not webhook_url:
            return {"status": "error", "message": "No WeCom webhook URL provided"}

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"## {title}\n\n{content}"
            },
        }
        try:
            response = requests.post(webhook_url, json=payload, timeout=8)
            return response.json()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    def _send_telegram(
        self,
        title: str,
        content: str,
        bot_token: str,
        chat_id: str,
        api_base: str,
        proxy_url: str,
    ) -> Dict[str, Any]:
        if not bot_token or not chat_id:
            return {"status": "error", "message": "Telegram bot token or chat id missing"}

        api_base = self._normalize_telegram_api_base(api_base)
        proxy_candidates = self._build_proxy_candidates(proxy_url)
        payload = {
            "chat_id": chat_id,
            "text": self._markdown_to_telegram_html(title, content),
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
        }
        saw_timeout = False
        for candidate in proxy_candidates:
            proxies = None
            if candidate:
                proxies = {"http": candidate, "https": candidate}
            try:
                response = requests.post(
                    f"{api_base}/bot{bot_token}/sendMessage",
                    json=payload,
                    timeout=8,
                    proxies=proxies,
                )
                return response.json()
            except requests.exceptions.Timeout:
                saw_timeout = True
                continue
            except requests.exceptions.RequestException:
                continue

        if saw_timeout:
            return {
                "status": "error",
                "message": "Telegram API 连接超时。请检查网络，或在设置页填写可用的 Telegram Proxy URL。",
            }
        return {
            "status": "error",
            "message": "Telegram API 请求失败。请检查 Bot Token、Chat ID，或把 Telegram Proxy URL 改成 socks5h://127.0.0.1:7892。",
        }

    def _detect_local_telegram_proxy(self) -> str:
        candidates = [
            ("socks5h://127.0.0.1:7892", "127.0.0.1", 7892),
            ("http://127.0.0.1:7890", "127.0.0.1", 7890),
            ("socks5h://127.0.0.1:1080", "127.0.0.1", 1080),
        ]
        for proxy_url, host, port in candidates:
            if self._is_port_open(host, port):
                return proxy_url
        return ""

    def _is_port_open(self, host: str, port: int) -> bool:
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except OSError:
            return False

    def _normalize_telegram_api_base(self, api_base: str) -> str:
        value = (api_base or "").strip()
        if not value:
            return "https://api.telegram.org"
        lowered = value.lower()
        if lowered.startswith(("socks5://", "socks5h://")):
            return "https://api.telegram.org"
        if not lowered.startswith(("http://", "https://")):
            return "https://api.telegram.org"
        return value.rstrip("/")

    def _build_proxy_candidates(self, proxy_url: str) -> List[str]:
        candidates: List[str] = []
        normalized = self._normalize_proxy_url(proxy_url)
        if normalized:
            candidates.append(normalized)

        detected = self._detect_local_telegram_proxy()
        if detected and detected not in candidates:
            candidates.append(detected)

        candidates.append("")
        return candidates

    def _normalize_proxy_url(self, proxy_url: str) -> str:
        value = (proxy_url or "").strip()
        if not value:
            return ""
        lowered = value.lower()
        if lowered.startswith(("http://", "https://", "socks5://", "socks5h://")):
            return value
        if ":" in value:
            host, port = value.rsplit(":", 1)
            if port == "7892":
                return f"socks5h://{host}:{port}"
            if port == "1080":
                return f"socks5h://{host}:{port}"
            return f"http://{host}:{port}"
        return value

    def _markdown_to_telegram_html(self, title: str, content: str) -> str:
        lines = [f"<b>{escape(title)}</b>"]

        for raw_line in content.splitlines():
            if not raw_line.strip():
                lines.append("")
                continue

            stripped = raw_line.lstrip()
            indent = len(raw_line) - len(stripped)

            if stripped.startswith("## "):
                lines.append(f"<b>{self._render_telegram_inline(stripped[3:])}</b>")
                continue

            if stripped.startswith("### "):
                lines.append(f"<b>{self._render_telegram_inline(stripped[4:])}</b>")
                continue

            if "|" in stripped and stripped.startswith("- ") and "---" not in stripped:
                columns = [part.strip() for part in stripped[2:].split("|")]
                if len(columns) >= 5:
                    priority, stock, expected, status, tactic = columns[:5]
                    if priority == "优先级" and stock == "股票":
                        continue
                    lines.append(
                        f"• <b>{self._render_telegram_inline(priority)} {self._render_telegram_inline(stock)}</b>"
                    )
                    lines.append(f"  开盘预期：{self._render_telegram_inline(expected)}")
                    lines.append(f"  竞价状态：{self._render_telegram_inline(status)}")
                    lines.append(f"  战术：{self._render_telegram_inline(tactic)}")
                    continue

            if stripped.startswith("- ---"):
                continue

            if stripped.startswith("- "):
                bullet = "•" if indent == 0 else "◦"
                lines.append(f"{bullet} {self._render_telegram_inline(stripped[2:])}")
                continue

            lines.append(self._render_telegram_inline(stripped))

        message = "\n".join(lines)
        return message[:3900]

    def _render_telegram_inline(self, text: str) -> str:
        token_pattern = re.compile(r"\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`")
        parts: List[str] = []
        cursor = 0

        for match in token_pattern.finditer(text):
            parts.append(escape(text[cursor:match.start()]))
            if match.group(1) and match.group(2):
                label = escape(match.group(1))
                url = escape(match.group(2), quote=True)
                parts.append(f'<a href="{url}">{label}</a>')
            elif match.group(3):
                parts.append(f"<b>{escape(match.group(3))}</b>")
            elif match.group(4):
                parts.append(f"<code>{escape(match.group(4))}</code>")
            cursor = match.end()

        parts.append(escape(text[cursor:]))
        return "".join(parts)

    def _mask_secret(self, value: str) -> str:
        if not value:
            return ""
        if len(value) <= 8:
            return "*" * len(value)
        return f"{value[:6]}***{value[-4:]}"

    def _is_success(self, result: Dict[str, Any], channel: str) -> bool:
        if channel == "feishu":
            return result.get("StatusCode") == 0 or result.get("code") == 0
        if channel == "wecom":
            return result.get("errcode") == 0
        if channel == "telegram":
            return result.get("ok") is True
        return False


notification_service = NotificationService()
