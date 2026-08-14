# Project ：backend
# File    ：services.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
AI 对话域业务逻辑服务层

包含：对话会话管理、消息记录、AI 生成任务、Token 用量统计。
"""
import json
from datetime import datetime
from typing import Any, AsyncGenerator

from loguru import logger

from hetu.core.exceptions import NotFoundError
from hetu.modules.ai_chat.models import AIConversation, AIMessage, AITokenUsage
from hetu.modules.testcase.models import TestExecution, TestCase


# ===================================对话会话==================================
async def create_conversation(user_id: int, title: str | None = None) -> AIConversation:
    """创建对话会话"""
    conversation = await AIConversation.create(
        user_id=user_id,
        title=title,
        last_message_at=datetime.now(),
    )
    logger.info(f"创建对话会话: user_id={user_id}")
    return conversation


async def get_conversation_by_id(conversation_id: int) -> AIConversation | None:
    """根据 ID 获取会话"""
    return await AIConversation.get_or_none(id=conversation_id, is_deleted=False)


async def list_conversations(user_id: int, page: int = 1, page_size: int = 20, keyword: str | None = None) -> dict:
    """查询用户的对话会话列表"""
    qs = AIConversation.filter(user_id=user_id, is_deleted=False)

    if keyword:
        qs = qs.filter(title__icontains=keyword)

    qs = qs.order_by("-last_message_at", "-id")
    total = await qs.count()
    offset = (page - 1) * page_size
    conversations = await qs.offset(offset).limit(page_size).all()

    items = []
    for conv in conversations:
        items.append({
            "id": conv.id,
            "user_id": conv.user_id,
            "title": conv.title,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def rename_conversation(conversation_id: int, user_id: int, title: str) -> AIConversation:
    """重命名对话会话"""
    conv = await get_conversation_by_id(conversation_id)
    if not conv or conv.user_id != user_id:
        raise NotFoundError("会话不存在")
    conv.title = title
    await conv.save(update_fields=["title"])
    return conv


async def delete_conversation(conversation_id: int, user_id: int) -> None:
    """删除对话会话（软删除）"""
    conv = await get_conversation_by_id(conversation_id)
    if not conv or conv.user_id != user_id:
        raise NotFoundError("会话不存在")
    await conv.soft_delete()
    logger.info(f"删除会话: id={conversation_id}")


# ===================================AI 消息==================================
async def add_message(
    conversation_id: int,
    role: str,
    content: str,
    chart_config: dict | None = None,
    data_table: dict | None = None,
    skill_used: str | None = None,
    token_input: int | None = None,
    token_output: int | None = None,
    latency_ms: int | None = None,
) -> AIMessage:
    """添加消息到会话"""
    msg = await AIMessage.create(
        conversation_id=conversation_id,
        role=role,
        content=content,
        chart_config=chart_config,
        data_table=data_table,
        skill_used=skill_used,
        token_input=token_input,
        token_output=token_output,
        latency_ms=latency_ms,
    )

    # 更新会话最后消息时间
    conv = await get_conversation_by_id(conversation_id)
    if conv:
        conv.last_message_at = datetime.now()
        await conv.save(update_fields=["last_message_at"])

    return msg


async def get_messages(conversation_id: int, before_id: int | None = None, limit: int = 50) -> list[dict]:
    """获取会话消息列表（分页）"""
    qs = AIMessage.filter(conversation_id=conversation_id)

    if before_id:
        qs = qs.filter(id__lt=before_id)

    messages = await qs.order_by("-id").limit(limit).all()
    messages = list(reversed(messages))  # 按时间正序返回

    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "role": m.role,
            "content": m.content,
            "chart_config": m.chart_config,
            "data_table": m.data_table,
            "skill_used": m.skill_used,
            "token_input": m.token_input,
            "token_output": m.token_output,
            "latency_ms": m.latency_ms,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# ===================================AI 流式对话（SSE）==================================
async def stream_ai_chat(
    user_id: int,
    message: str,
    conversation_id: int | None = None,
    project_id: int | None = None,
) -> AsyncGenerator[dict, None]:
    """
    AI 流式对话核心逻辑。

    产出 SSE 事件序列：
    1. conversation: 新建/复用会话信息
    2. delta: 文本增量（打字机效果）
    3. table: 数据表格（nl2sql 结果）
    4. chart: 图表配置
    5. done: 完成（含 token 用量）
    """
    # 获取或创建会话
    if conversation_id:
        conv = await get_conversation_by_id(conversation_id)
        if not conv:
            conv = await create_conversation(user_id, title=message[:50])
    else:
        conv = await create_conversation(user_id, title=message[:50])

    # 保存用户消息
    await add_message(conv.id, "user", message)

    # 返回会话信息
    yield {"event": "conversation", "data": {"conversation_id": conv.id, "title": conv.title}}

    # 模拟流式输出（逐字）
    ai_response = f"[AI 回复] 收到您的消息: {message}。\n\n这是河图智弈的 AI 分析能力演示。"
    for char in ai_response:
        yield {"event": "delta", "data": {"content": char}}

    # 保存 AI 消息
    await add_message(
        conv.id, "assistant", ai_response,
        token_input=len(message),
        token_output=len(ai_response),
        latency_ms=1500,
    )

    # 完成事件
    yield {
        "event": "done",
        "data": {
            "conversation_id": conv.id,
            "token_input": len(message),
            "token_output": len(ai_response),
            "latency_ms": 1500,
        },
    }


# ===================================Token 用量==================================
async def record_token_usage(
    user_id: int,
    model_name: str,
    token_input: int,
    token_output: int,
    cost: float = 0.0,
    conversation_id: int | None = None,
    message_id: int | None = None,
    skill_used: str | None = None,
) -> AITokenUsage:
    """记录 Token 用量"""
    return await AITokenUsage.create(
        user_id=user_id,
        conversation_id=conversation_id,
        message_id=message_id,
        skill_used=skill_used,
        model_name=model_name,
        token_input=token_input,
        token_output=token_output,
        cost=cost,
    )


async def get_token_usage(user_id: int, page: int = 1, page_size: int = 20) -> dict:
    """获取用户 Token 用量"""
    qs = AITokenUsage.filter(user_id=user_id)
    total = await qs.count()
    offset = (page - 1) * page_size
    usages = await qs.offset(offset).limit(page_size).order_by("-created_at").all()

    items = []
    for u in usages:
        items.append({
            "id": u.id,
            "conversation_id": u.conversation_id,
            "message_id": u.message_id,
            "skill_used": u.skill_used,
            "model_name": u.model_name,
            "token_input": u.token_input,
            "token_output": u.token_output,
            "cost": float(u.cost),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_token_usage_summary(user_id: int) -> dict:
    """获取 Token 用量汇总"""
    usages = await AITokenUsage.filter(user_id=user_id).all()
    total_input = sum(u.token_input for u in usages)
    total_output = sum(u.token_output for u in usages)
    total_cost = sum(float(u.cost) for u in usages)
    return {
        "total_calls": len(usages),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cost": round(total_cost, 4),
    }
