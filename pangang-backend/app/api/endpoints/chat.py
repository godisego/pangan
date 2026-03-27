from typing import List, Literal, Optional
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from zhipuai import ZhipuAI


router = APIRouter()

DEFAULT_CHAT_MODEL = os.getenv("ZHIPUAI_MODEL", "glm-4.7-flash")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = "zhipu"
    api_key: Optional[str] = None
    model: Optional[str] = None


@router.post("")
def create_chat_completion(payload: ChatRequest):
    provider = (payload.provider or "zhipu").lower()
    if provider not in {"zhipu", ""}:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    api_key = payload.api_key or os.getenv("ZHIPUAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing API key for Zhipu AI")

    if not payload.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    model = payload.model or DEFAULT_CHAT_MODEL
    client = ZhipuAI(api_key=api_key)

    try:
        messages_payload = [
            message.model_dump() if hasattr(message, "model_dump") else message.dict()
            for message in payload.messages
        ]
        response = client.chat.completions.create(
            model=model,
            messages=messages_payload,
            temperature=0.3,
        )
        content = response.choices[0].message.content if response.choices else ""
        return {
            "reply": content,
            "provider": "zhipu",
            "model": model,
            "used_api": True,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Zhipu chat failed: {exc}") from exc
