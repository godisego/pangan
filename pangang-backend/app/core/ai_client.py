from typing import Any, Dict, List, Optional

import requests
from requests import exceptions as requests_exceptions

from .ai_provider_registry import (
    get_provider_config,
    normalize_provider,
    resolve_provider_api_key,
    resolve_provider_base_url,
    resolve_provider_model,
)
from .outbound_network import build_request_kwargs


def _extract_message_content(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""

    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = [
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("type") in {"text", "output_text"}
        ]
        return "\n".join(part for part in text_parts if part)
    return str(content or "")


def _extract_error_message(payload: Dict[str, Any]) -> str:
    error = payload.get("error")
    if isinstance(error, dict):
        for key in ("message", "detail", "code"):
            value = error.get(key)
            if value:
                return str(value)
    if isinstance(error, str):
        return error
    detail = payload.get("detail")
    if detail:
        return str(detail)
    return "Unknown provider error"


def _messages_to_text(messages: List[Dict[str, str]]) -> str:
    parts: List[str] = []
    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")
        if content:
            parts.append(f"{role.upper()}:\n{content}")
    return "\n\n".join(parts)


def _resolve_timeout(provider_id: str, model: str, requested_timeout: float) -> float:
    normalized_model = (model or "").strip().lower()
    timeout = max(float(requested_timeout or 0), 25.0)

    if provider_id == "zhipu":
        if "4.6v" in normalized_model or normalized_model.endswith("v"):
            return max(timeout, 90.0)
        if "4.6" in normalized_model or "4.5" in normalized_model:
            return max(timeout, 75.0)
        return max(timeout, 60.0)

    if provider_id in {"anthropic", "gemini"}:
        return max(timeout, 60.0)

    if provider_id in {"openai", "custom"}:
        return max(timeout, 45.0)

    return timeout


def _request_openai_style(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    timeout: float,
    use_proxy: bool,
) -> Dict[str, Any]:
    request_kwargs = build_request_kwargs(timeout=timeout, use_proxy=use_proxy)
    response = None
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            response = requests.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                },
                **request_kwargs,
            )
            break
        except (requests_exceptions.ReadTimeout, requests_exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt == 1:
                raise RuntimeError(str(exc)) from exc

    if response is None:
        raise RuntimeError(str(last_error or "Empty provider response"))

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if not response.ok:
        raise RuntimeError(_extract_error_message(payload))

    content = _extract_message_content(payload)
    if not content:
        raise RuntimeError("Provider returned empty content")

    return payload | {"_content": content}


def _request_anthropic_style(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    timeout: float,
    use_proxy: bool,
) -> Dict[str, Any]:
    system_parts = [message["content"] for message in messages if message.get("role") == "system"]
    conversation = [
        {"role": message["role"], "content": message["content"]}
        for message in messages
        if message.get("role") in {"user", "assistant"}
    ]
    request_kwargs = build_request_kwargs(timeout=timeout, use_proxy=use_proxy)
    response = None
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            response = requests.post(
                f"{base_url.rstrip('/')}/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 2048,
                    "temperature": temperature,
                    "system": "\n\n".join(system_parts) if system_parts else None,
                    "messages": conversation,
                },
                **request_kwargs,
            )
            break
        except (requests_exceptions.ReadTimeout, requests_exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt == 1:
                raise RuntimeError(str(exc)) from exc

    if response is None:
        raise RuntimeError(str(last_error or "Empty provider response"))

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if not response.ok:
        raise RuntimeError(_extract_error_message(payload))

    content_items = payload.get("content") or []
    text = "\n".join(
        item.get("text", "")
        for item in content_items
        if isinstance(item, dict) and item.get("type") == "text"
    ).strip()
    if not text:
        raise RuntimeError("Anthropic returned empty content")

    return payload | {"_content": text}


def _request_gemini_style(
    *,
    base_url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    timeout: float,
    use_proxy: bool,
) -> Dict[str, Any]:
    request_kwargs = build_request_kwargs(timeout=timeout, use_proxy=use_proxy)
    response = None
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            response = requests.post(
                f"{base_url.rstrip('/')}/models/{model}:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": _messages_to_text(messages)}],
                        }
                    ],
                    "generationConfig": {
                        "temperature": temperature,
                    },
                },
                **request_kwargs,
            )
            break
        except (requests_exceptions.ReadTimeout, requests_exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt == 1:
                raise RuntimeError(str(exc)) from exc

    if response is None:
        raise RuntimeError(str(last_error or "Empty provider response"))

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if not response.ok:
        raise RuntimeError(_extract_error_message(payload))

    candidates = payload.get("candidates") or []
    parts = []
    if candidates:
        content = candidates[0].get("content") or {}
        for item in content.get("parts") or []:
            if isinstance(item, dict) and item.get("text"):
                parts.append(item["text"])

    text = "\n".join(parts).strip()
    if not text:
        raise RuntimeError("Gemini returned empty content")

    return payload | {"_content": text}


def request_chat_completion(
    *,
    provider: Optional[str],
    api_key: Optional[str],
    model: Optional[str],
    base_url: Optional[str] = None,
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    timeout: float = 30.0,
) -> Dict[str, Any]:
    provider_id = normalize_provider(provider)
    if not provider_id:
        raise ValueError(f"Unsupported provider: {provider}")

    config = get_provider_config(provider_id)
    if not config:
        raise ValueError(f"Unsupported provider: {provider_id}")

    resolved_api_key = resolve_provider_api_key(provider_id, api_key)
    if not resolved_api_key:
        raise ValueError(f"Missing API key for {config['label']}")

    resolved_model = resolve_provider_model(provider_id, model)
    if not resolved_model:
        raise ValueError(f"Missing model for {config['label']}")
    resolved_base_url = resolve_provider_base_url(provider_id, base_url)
    if not resolved_base_url:
        raise ValueError(f"Missing base URL for {config['label']}")
    resolved_timeout = _resolve_timeout(provider_id, resolved_model, timeout)

    request_style = config.get("request_style", "openai")
    use_proxy = bool(config.get("use_proxy"))
    try:
        if request_style == "anthropic":
            payload = _request_anthropic_style(
                base_url=resolved_base_url,
                api_key=resolved_api_key,
                model=resolved_model,
                messages=messages,
                temperature=temperature,
                timeout=resolved_timeout,
                use_proxy=use_proxy,
            )
        elif request_style == "gemini":
            payload = _request_gemini_style(
                base_url=resolved_base_url,
                api_key=resolved_api_key,
                model=resolved_model,
                messages=messages,
                temperature=temperature,
                timeout=resolved_timeout,
                use_proxy=use_proxy,
            )
        else:
            payload = _request_openai_style(
                base_url=resolved_base_url,
                api_key=resolved_api_key,
                model=resolved_model,
                messages=messages,
                temperature=temperature,
                timeout=resolved_timeout,
                use_proxy=use_proxy,
            )
    except RuntimeError as exc:
        raise RuntimeError(f"{config['label']} chat failed: {exc}") from exc

    return {
        "reply": payload["_content"],
        "provider": provider_id,
        "provider_label": config["label"],
        "model": resolved_model,
        "used_api": True,
        "raw": payload,
    }
