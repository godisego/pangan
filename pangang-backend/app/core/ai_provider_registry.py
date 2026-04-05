import os
from copy import deepcopy
from typing import Any, Dict, List, Optional


ProviderModel = Dict[str, str]
ProviderConfig = Dict[str, Any]


AI_PROVIDERS: Dict[str, ProviderConfig] = {
    "zhipu": {
        "id": "zhipu",
        "label": "智谱",
        "description": "自动使用智谱开放平台通用接口，无需额外填写 Base URL。",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "env_api_key": "ZHIPUAI_API_KEY",
        "default_model": os.getenv("ZHIPUAI_MODEL", "glm-4.7-flash"),
        "api_key_label": "智谱 API Key",
        "api_key_placeholder": "请输入智谱开放平台 API Key",
        "use_proxy": False,
        "models": [
            {"id": "glm-4.7-flash", "label": "GLM-4.7-Flash"},
            {"id": "glm-4.7", "label": "GLM-4.7"},
            {"id": "glm-4.6", "label": "GLM-4.6"},
            {"id": "glm-4.6v", "label": "GLM-4.6V"},
            {"id": "glm-4.6v-flash", "label": "GLM-4.6V-Flash"},
            {"id": "glm-4.5-air", "label": "GLM-4.5-Air"},
            {"id": "glm-4.5-airx", "label": "GLM-4.5-AirX"},
            {"id": "glm-4.5-flash", "label": "GLM-4.5-Flash"},
            {"id": "glm-4.5-x", "label": "GLM-4.5-X"},
            {"id": "glm-4.1v-thinking-flash", "label": "GLM-4.1V-Thinking-Flash"},
            {"id": "glm-4.1v-thinking-flashx", "label": "GLM-4.1V-Thinking-FlashX"},
        ],
    },
    "openai": {
        "id": "openai",
        "label": "OpenAI",
        "description": "自动使用 OpenAI 官方接口。",
        "base_url": "https://api.openai.com/v1",
        "env_api_key": "OPENAI_API_KEY",
        "default_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "api_key_label": "OpenAI API Key",
        "api_key_placeholder": "请输入 OpenAI API Key",
        "request_style": "openai",
        "use_proxy": True,
        "models": [
            {"id": "gpt-4o-mini", "label": "GPT-4o Mini"},
            {"id": "gpt-4.1-mini", "label": "GPT-4.1 Mini"},
            {"id": "gpt-4.1", "label": "GPT-4.1"},
            {"id": "gpt-4o", "label": "GPT-4o"},
            {"id": "o4-mini", "label": "o4-mini"},
        ],
    },
    "anthropic": {
        "id": "anthropic",
        "label": "Claude",
        "description": "自动使用 Anthropic Claude 官方接口。",
        "base_url": "https://api.anthropic.com/v1",
        "env_api_key": "ANTHROPIC_API_KEY",
        "default_model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
        "api_key_label": "Anthropic API Key",
        "api_key_placeholder": "请输入 Claude API Key",
        "request_style": "anthropic",
        "use_proxy": True,
        "models": [
            {"id": "claude-3-5-sonnet-latest", "label": "Claude 3.5 Sonnet"},
            {"id": "claude-3-7-sonnet-latest", "label": "Claude 3.7 Sonnet"},
            {"id": "claude-3-5-haiku-latest", "label": "Claude 3.5 Haiku"},
        ],
    },
    "gemini": {
        "id": "gemini",
        "label": "Gemini",
        "description": "自动使用 Google Gemini 官方接口。",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "env_api_key": "GEMINI_API_KEY",
        "default_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "api_key_label": "Gemini API Key",
        "api_key_placeholder": "请输入 Gemini API Key",
        "request_style": "gemini",
        "use_proxy": True,
        "models": [
            {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
            {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
            {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
        ],
    },
    "dashscope": {
        "id": "dashscope",
        "label": "阿里云百炼",
        "description": "自动使用百炼 OpenAI 兼容接口，无需额外填写 Base URL。",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "env_api_key": "DASHSCOPE_API_KEY",
        "default_model": os.getenv("DASHSCOPE_MODEL", "qwen-plus"),
        "api_key_label": "百炼 API Key",
        "api_key_placeholder": "请输入阿里云百炼 API Key",
        "request_style": "openai",
        "use_proxy": False,
        "models": [
            {"id": "qwen-plus", "label": "Qwen Plus"},
            {"id": "qwen-max", "label": "Qwen Max"},
            {"id": "qwen-flash", "label": "Qwen Flash"},
            {"id": "qwen-turbo", "label": "Qwen Turbo"},
            {"id": "qwen3-max", "label": "Qwen3 Max"},
            {"id": "qwen3-coder-plus", "label": "Qwen3 Coder Plus"},
        ],
    },
    "minimax": {
        "id": "minimax",
        "label": "MiniMax",
        "description": "自动使用 MiniMax OpenAI 兼容接口，支持通用 Key 与 Coding Plan Key。",
        "base_url": "https://api.minimax.io/v1",
        "env_api_key": "MINIMAX_API_KEY",
        "default_model": os.getenv("MINIMAX_MODEL", "MiniMax-M2.5"),
        "api_key_label": "MiniMax API Key",
        "api_key_placeholder": "请输入 MiniMax API Key 或 Coding Plan Key",
        "request_style": "openai",
        "use_proxy": False,
        "models": [
            {"id": "MiniMax-M2.5", "label": "MiniMax M2.5"},
            {"id": "MiniMax-M2.5-highspeed", "label": "MiniMax M2.5 Highspeed"},
            {"id": "MiniMax-M2.1", "label": "MiniMax M2.1"},
            {"id": "MiniMax-M2.1-highspeed", "label": "MiniMax M2.1 Highspeed"},
            {"id": "MiniMax-M2", "label": "MiniMax M2"},
        ],
    },
    "custom": {
        "id": "custom",
        "label": "自定义兼容接口",
        "description": "适用于 OpenAI 兼容网关或自建中转，需要填写 Base URL。",
        "base_url": "",
        "env_api_key": "",
        "default_model": "gpt-4o-mini",
        "api_key_label": "兼容接口 API Key",
        "api_key_placeholder": "请输入兼容接口 API Key",
        "request_style": "openai",
        "use_proxy": True,
        "requires_base_url": True,
        "models": [
            {"id": "gpt-4o-mini", "label": "gpt-4o-mini"},
            {"id": "gpt-4.1-mini", "label": "gpt-4.1-mini"},
            {"id": "claude-3-5-sonnet-latest", "label": "claude-3-5-sonnet-latest"},
            {"id": "gemini-2.5-flash", "label": "gemini-2.5-flash"},
            {"id": "qwen-plus", "label": "qwen-plus"},
        ],
    },
}


def normalize_provider(provider: Optional[str]) -> Optional[str]:
    candidate = (provider or "").strip().lower()
    if not candidate:
        return "zhipu"
    return candidate if candidate in AI_PROVIDERS else None


def get_provider_config(provider: Optional[str]) -> Optional[ProviderConfig]:
    provider_id = normalize_provider(provider)
    if not provider_id:
        return None
    return AI_PROVIDERS[provider_id]


def resolve_provider_api_key(provider: Optional[str], override: Optional[str] = None) -> Optional[str]:
    if override:
        return override.strip()
    config = get_provider_config(provider)
    if not config:
        return None
    env_key = config.get("env_api_key")
    return (os.getenv(env_key or "") or "").strip() or None


def resolve_provider_model(provider: Optional[str], requested_model: Optional[str] = None) -> Optional[str]:
    config = get_provider_config(provider)
    if not config:
        return None
    model = (requested_model or "").strip()
    return model or config["default_model"]


def resolve_provider_base_url(provider: Optional[str], override: Optional[str] = None) -> Optional[str]:
    config = get_provider_config(provider)
    if not config:
        return None
    custom = (override or "").strip()
    if custom:
        return custom.rstrip("/")
    base_url = (config.get("base_url") or "").strip()
    if base_url:
        return base_url.rstrip("/")
    return None


def get_public_provider_catalog() -> Dict[str, List[ProviderConfig]]:
    providers: List[ProviderConfig] = []
    for config in AI_PROVIDERS.values():
        item = {
            "id": config["id"],
            "label": config["label"],
            "description": config["description"],
            "default_model": config["default_model"],
            "api_key_label": config["api_key_label"],
            "api_key_placeholder": config["api_key_placeholder"],
            "requires_base_url": bool(config.get("requires_base_url")),
            "base_url_placeholder": config.get("base_url") or "https://your-endpoint.example/v1",
            "models": deepcopy(config["models"]),
        }
        providers.append(item)
    return {"providers": providers}
