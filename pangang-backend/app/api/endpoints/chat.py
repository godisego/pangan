from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ...core.ai_client import request_chat_completion
from ...core.ai_provider_registry import get_public_provider_catalog, normalize_provider

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = "zhipu"
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


class ChatTestRequest(BaseModel):
    provider: Optional[str] = "zhipu"
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


@router.get("/providers")
def get_chat_providers():
    return get_public_provider_catalog()


@router.post("/test")
def test_chat_provider(payload: ChatTestRequest):
    provider = normalize_provider(payload.provider)
    if not provider:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {payload.provider}")

    try:
        result = request_chat_completion(
            provider=provider,
            api_key=payload.api_key,
            model=payload.model,
            base_url=payload.base_url,
            messages=[
                {
                    "role": "system",
                    "content": "你是 AI 配置验证助手。只回答一句简短确认。",
                },
                {
                    "role": "user",
                    "content": "请只回复：连接成功",
                },
            ],
            temperature=0.0,
            timeout=35.0,
        )
        return {
            "status": "success",
            "reply": result["reply"],
            "provider": result["provider"],
            "model": result["model"],
            "used_api": result["used_api"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("")
def create_chat_completion(payload: ChatRequest):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    try:
        messages_payload = [
            message.model_dump() if hasattr(message, "model_dump") else message.dict()
            for message in payload.messages
        ]
        result = request_chat_completion(
            provider=payload.provider,
            api_key=payload.api_key,
            model=payload.model,
            base_url=payload.base_url,
            messages=messages_payload,
            temperature=0.3,
            timeout=45.0,
        )
        return {
            "reply": result["reply"],
            "provider": result["provider"],
            "model": result["model"],
            "used_api": result["used_api"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
