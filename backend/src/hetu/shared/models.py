# Project ：backend
# File    ：models.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
公共模型 Mixin

所有数据表共享的字段抽取为 Mixin，避免在每个模型重复定义。
"""
from datetime import datetime

from tortoise import fields
from tortoise.models import Model


class TimestampMixin(Model):
    """时间戳 mixin：所有表统一含创建/更新时间"""

    created_at = fields.DatetimeField(auto_now_add=True, index=True, description="创建时间")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")

    class Meta:
        abstract = True


class SoftDeleteMixin(Model):
    """软删除 mixin：业务主表支持软删除，保留数据可追溯"""

    is_deleted = fields.BooleanField(default=False, index=True, description="是否软删除")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        abstract = True

    async def soft_delete(self) -> None:
        """软删除：置位标记并记录删除时间"""
        self.is_deleted = True
        self.deleted_at = datetime.now()
        await self.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
