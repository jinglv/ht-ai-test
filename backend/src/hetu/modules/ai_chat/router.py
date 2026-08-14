# Project ：backend
# File    ：router.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
AI 对话域路由

包含：SSE 流式对话、会话管理、消息历史、Token 用量
"""
import json
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from hetu.core.deps import current_user
from hetu.core.exceptions import NotFoundError, ValidationError
from hetu.core.rbac import require_permission
from hetu.core.response import json_ok
from hetu.modules.ai_chat.schemas import (
    AIChatRequest,
    AIConversationResponse,
    AIMessageResponse,
    AITokenUsageResponse,
)
from hetu.modules.ai_chat.services import (
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation_by_id,
    get_messages,
    get_token_usage,
    get_token_usage_summary,
    list_conversations,
    record_token_usage,
    rename_conversation,
    stream_ai_chat,
)

ai_router = APIRouter(prefix="/ai", tags=["AI 对话"])


# ===================================SSE 流式对话==================================
@ai_router.post("/chat", summary="AI 对话（SSE 流式）")
async def ai_chat_stream(
    request: Request,
    body: AIChatRequest,
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """
    AI 对话接口（SSE 流式返回）。

    事件类型：
    - conversation: 会话信息
    - delta: 文本增量
    - table: 数据表格
    - chart: 图表配置
    - done: 完成
    - error: 错误
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for event in stream_ai_chat(
                user_id=user["user_id"],
                message=body.message,
                conversation_id=body.conversation_id,
                project_id=body.project_id,
            ):
                yield f"event: {event['event']}\n"
                yield f"data: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"event: error\n"
            yield f"data: {json.dumps({'code': 3001, 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===================================会话管理==================================
@ai_router.get("/conversations", summary="对话会话列表")
async def list_conversations_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None),
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """查询用户的对话会话列表"""
    result = await list_conversations(user["user_id"], page, page_size, keyword)
    return json_ok(result)


@ai_router.get("/conversations/{conversation_id}/messages", summary="会话消息历史")
async def get_conversation_messages(
    request: Request,
    conversation_id: int,
    before_id: int | None = Query(None, description="起始消息 ID（用于分页）"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """获取会话消息列表"""
    conv = await get_conversation_by_id(conversation_id)
    if not conv or conv.user_id != user["user_id"]:
        raise NotFoundError("会话不存在")

    messages = await get_messages(conversation_id, before_id, limit)
    return json_ok(messages)


@ai_router.patch("/conversations/{conversation_id}", summary="重命名会话")
async def rename_conversation_api(
    request: Request,
    conversation_id: int,
    body: dict,
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """重命名对话会话"""
    title = body.get("title", "")
    if not title:
        raise ValidationError("title 不能为空")

    conv = await rename_conversation(conversation_id, user["user_id"], title)
    return json_ok({"id": conv.id, "title": conv.title}, "重命名成功")


@ai_router.delete("/conversations/{conversation_id}", summary="删除会话")
async def delete_conversation_api(
    request: Request,
    conversation_id: int,
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """删除对话会话（软删除）"""
    await delete_conversation(conversation_id, user["user_id"])
    return json_ok(message="删除成功")


@ai_router.post("/conversations/{conversation_id}/stop", summary="停止生成")
async def stop_generation(
    request: Request,
    conversation_id: int,
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """停止 AI 生成（前端断开 SSE 连接即可，后端可选记录）"""
    return json_ok(message="已停止")


# ===================================Token 用量==================================
@ai_router.get("/token-usage", summary="Token 用量记录")
async def get_token_usage_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """获取用户 Token 用量记录"""
    result = await get_token_usage(user["user_id"], page, page_size)
    return json_ok(result)


@ai_router.get("/token-usage/summary", summary="Token 用量汇总")
async def get_token_usage_summary_api(
    request: Request,
    user: dict = Depends(require_permission("ai_chat:view")),
):
    """获取用户 Token 用量汇总"""
    summary = await get_token_usage_summary(user["user_id"])
    return json_ok(summary)
