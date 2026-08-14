# Project ：backend
# File    ：schemas.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
AI 对话域请求/响应 DTO
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from hetu.shared.enums import MessageRole


# ===================================AI 对话==================================
class AIChatRequest(BaseModel):
    """AI 对话请求"""

    message: str = Field(min_length=1, description="用户消息")
    conversation_id: Optional[int] = Field(None, description="会话 ID（不传则新建）")
    project_id: Optional[int] = Field(None, description="关联项目（用于数据权限过滤）")


class AIChatStreamResponse(BaseModel):
    """AI 对话流式响应事件"""

    event: str = Field(description="事件类型: conversation/delta/table/chart/tool/done/error")
    data: dict = Field(default_factory=dict, description="事件数据")


class AIConversationResponse(BaseModel):
    """对话会话响应"""

    id: int
    user_id: int
    title: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class AIMessageResponse(BaseModel):
    """AI 消息响应"""

    id: int
    conversation_id: int
    role: str
    content: str
    chart_config: Optional[dict] = None
    data_table: Optional[dict] = None
    skill_used: Optional[str] = None
    token_input: Optional[int] = None
    token_output: Optional[int] = None
    latency_ms: Optional[int] = None
    created_at: Optional[datetime] = None


class AITokenUsageResponse(BaseModel):
    """Token 用量响应"""

    id: int
    conversation_id: Optional[int] = None
    message_id: Optional[int] = None
    skill_used: Optional[str] = None
    model_name: str
    token_input: int
    token_output: int
    cost: float
    created_at: Optional[datetime] = None
