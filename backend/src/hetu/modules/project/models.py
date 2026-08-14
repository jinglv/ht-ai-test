# Project ：backend
# File    ：models.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
项目域模型

包含：测试项目 (Project)、项目模块 (ProjectModule)、项目成员 (ProjectMember)
"""
from tortoise import fields
from tortoise.models import Model

from hetu.modules.rbac.models import User
from hetu.shared.enums import ProjectRole, ProjectStatus
from hetu.shared.models import SoftDeleteMixin, TimestampMixin


class Project(SoftDeleteMixin, TimestampMixin, Model):
    """测试项目表"""

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, unique=True, description="项目编号全局唯一")
    name = fields.CharField(max_length=128, description="项目名称")
    owner = fields.ForeignKeyField(
        "models.User",
        related_name="owned_projects",
        on_delete=fields.NO_ACTION,
        description="项目负责人",
    )
    status = fields.CharField(
        max_length=20, default="planning", description="项目状态: planning/in_progress/completed/archived"
    )
    start_date = fields.DateField(null=True, description="开始日期")
    end_date = fields.DateField(null=True, description="结束日期")
    description = fields.TextField(null=True, description="项目描述")

    modules: fields.ReverseRelation["ProjectModule"]
    members: fields.ReverseRelation["ProjectMember"]
    testcases: fields.ReverseRelation["TestCase"]
    suites: fields.ReverseRelation["TestSuite"]
    requirement_docs: fields.ReverseRelation["RequirementDoc"]

    class Meta:
        table = "project"
        table_description = "测试项目"
        indexes = (("status", "is_deleted"),)


class ProjectModule(TimestampMixin, Model):
    """项目模块表：树形结构，用例归属到具体模块"""

    id = fields.IntField(pk=True)
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="modules",
        on_delete=fields.CASCADE,
        description="所属项目",
    )
    parent = fields.ForeignKeyField(
        "models.ProjectModule",
        null=True,
        related_name="children",
        on_delete=fields.NO_ACTION,
        description="父模块",
    )
    name = fields.CharField(max_length=128, description="模块名称")
    sort = fields.IntField(default=0, description="排序")

    testcases: fields.ReverseRelation["TestCase"]

    class Meta:
        table = "project_module"
        table_description = "项目模块"
        indexes = (("project_id", "parent_id"),)


class ProjectMember(TimestampMixin, Model):
    """项目成员表：非成员默认不可访问项目数据"""

    id = fields.IntField(pk=True)
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="members",
        on_delete=fields.CASCADE,
        description="所属项目",
    )
    user = fields.ForeignKeyField(
        "models.User",
        related_name="project_memberships",
        on_delete=fields.CASCADE,
        description="成员用户",
    )
    project_role = fields.CharField(
        max_length=20, description="项目内角色: owner/tester/viewer"
    )

    class Meta:
        table = "project_member"
        table_description = "项目成员"
        unique_together = (("project_id", "user_id"),)
