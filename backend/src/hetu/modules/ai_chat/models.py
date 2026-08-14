# Project ：backend
# File    ：models.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
AI 对话域模型

包含：AI 对话会话 (AIConversation)、AI 消息 (AIMessage)、
      AI 生成任务 (AIGenerationTask)、AI Token 用量 (AITokenUsage)
"""
from decimal import Decimal

from tortoise import fields
from tortoise.models import Model

from hetu.modules.rbac.models import User
from hetu.shared.enums import MessageRole, TaskStatus
from hetu.shared.models import SoftDeleteMixin, TimestampMixin


class AIConversation(SoftDeleteMixin, TimestampMixin, Model):
    """AI 对话会话表"""

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="conversations",
        on_delete=fields.CASCADE,
        description="所属用户",
    )
    title = fields.CharField(max_length=255, null=True, description="会话标题")
    last_message_at = fields.DatetimeField(null=True, description="最近消息时间")

    messages: fields.ReverseRelation["AIMessage"]

    class Meta:
        table = "ai_conversation"
        table_description = "AI 对话会话"
        indexes = (("user_id", "is_deleted", "last_message_at"),)


class AIMessage(Model):
    """AI 对话消息表：含图表配置与数据表格"""

    id = fields.IntField(pk=True)
    conversation = fields.ForeignKeyField(
        "models.AIConversation",
        related_name="messages",
        on_delete=fields.CASCADE,
        description="所属会话",
    )
    role = fields.CharField(max_length=20, description="消息角色: user/assistant/system")
    content = fields.TextField(description="消息内容")
    chart_config = fields.JSONField(null=True, description="图表配置")
    data_table = fields.JSONField(null=True, description="数据表格")
    skill_used = fields.CharField(max_length=64, null=True, description="触发的技能")
    token_input = fields.IntField(null=True, description="输入 token")
    token_output = fields.IntField(null=True, description="输出 token")
    latency_ms = fields.IntField(null=True, description="响应耗时(毫秒)")
    created_at = fields.DatetimeField(auto_now_add=True, index=True, description="创建时间")

    class Meta:
        table = "ai_message"
        table_description = "AI 对话消息"
        indexes = (("conversation_id", "created_at"),)


class AIGenerationTask(TimestampMixin, Model):
    """AI 用例生成任务表"""

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="ai_tasks",
        on_delete=fields.CASCADE,
        description="发起人",
    )
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="ai_tasks",
        on_delete=fields.CASCADE,
        description="目标项目",
    )
    source_doc = fields.ForeignKeyField(
        "models.RequirementDoc",
        null=True,
        related_name="ai_tasks",
        on_delete=fields.SET_NULL,
        description="来源需求文档",
    )
    prompt = fields.TextField(description="用户提问/指令")
    status = fields.CharField(max_length=20, default="pending", description="任务状态")
    generated_count = fields.IntField(default=0, description="已生成用例数")
    saved_count = fields.IntField(default=0, description="已入库用例数")
    result_preview = fields.JSONField(null=True, description="生成的用例预览")
    error_message = fields.TextField(null=True, description="失败原因")
    started_at = fields.DatetimeField(null=True, description="开始执行时间")
    finished_at = fields.DatetimeField(null=True, description="完成时间")

    class Meta:
        table = "ai_generation_task"
        table_description = "AI 用例生成任务"
        indexes = (("user_id", "status"), ("project_id", "status"))


class AITokenUsage(Model):
    """AI Token 用量记录表"""

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="token_usages",
        on_delete=fields.CASCADE,
        description="调用人",
    )
    conversation = fields.ForeignKeyField(
        "models.AIConversation",
        null=True,
        related_name="token_usages",
        on_delete=fields.SET_NULL,
        description="关联会话",
    )
    message = fields.ForeignKeyField(
        "models.AIMessage",
        null=True,
        related_name="token_usages",
        on_delete=fields.SET_NULL,
        description="关联消息",
    )
    skill_used = fields.CharField(max_length=64, null=True, description="触发的技能")
    model_name = fields.CharField(max_length=64, description="模型名")
    token_input = fields.IntField(description="输入 token")
    token_output = fields.IntField(description="输出 token")
    cost = fields.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"), description="估算成本(元)")
    created_at = fields.DatetimeField(auto_now_add=True, index=True, description="创建时间")

    class Meta:
        table = "ai_token_usage"
        table_description = "AI Token 用量记录"
        indexes = (("user_id", "created_at"), ("skill_used", "created_at"))
