# Project ：backend
# File    ：models.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
用例域模型

包含：需求文档 (RequirementDoc)、测试用例 (TestCase)、测试套件 (TestSuite)、
      套件-用例关联 (TestSuiteCase)、执行记录 (TestExecution)
"""
from decimal import Decimal

from tortoise import fields
from tortoise.models import Model

from hetu.modules.project.models import Project, ProjectModule
from hetu.modules.rbac.models import User
from hetu.shared.enums import (
    CaseStatus,
    CaseType,
    DocFileType,
    ExecutionResult,
    Priority,
)
from hetu.shared.models import SoftDeleteMixin, TimestampMixin


class RequirementDoc(SoftDeleteMixin, TimestampMixin, Model):
    """需求文档表：上传后解析入库，支持全文检索"""

    id = fields.IntField(pk=True)
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="requirement_docs",
        on_delete=fields.CASCADE,
        description="所属项目",
    )
    title = fields.CharField(max_length=255, description="文档标题")
    content = fields.TextField(null=True, description="解析后纯文本内容")
    file_type = fields.CharField(max_length=20, description="文件类型: markdown/word/pdf/text")
    file_url = fields.CharField(max_length=255, null=True, description="原始文件存储路径")
    file_size = fields.IntField(null=True, description="文件大小(字节)")
    uploaded_by = fields.ForeignKeyField(
        "models.User",
        related_name="uploaded_docs",
        on_delete=fields.NO_ACTION,
        description="上传人",
    )

    testcases: fields.ReverseRelation["TestCase"]

    class Meta:
        table = "requirement_doc"
        table_description = "需求文档"
        indexes = (("project_id", "is_deleted"),)


class TestCase(SoftDeleteMixin, TimestampMixin, Model):
    """测试用例表（AI 核心模块）"""

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="用例编号 TC-{项目编号}-{序号}")
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="testcases",
        on_delete=fields.CASCADE,
        description="所属项目",
    )
    module = fields.ForeignKeyField(
        "models.ProjectModule",
        null=True,
        related_name="testcases",
        on_delete=fields.SET_NULL,
        description="所属模块",
    )
    title = fields.CharField(max_length=255, description="用例标题")
    precondition = fields.TextField(null=True, description="前置条件")
    steps = fields.JSONField(default=list, description="测试步骤有序列表")
    expected_result = fields.TextField(null=True, description="预期结果")
    priority = fields.CharField(max_length=10, default="P2", description="优先级 P0/P1/P2/P3")
    case_type = fields.CharField(max_length=20, default="functional", description="用例类型")
    status = fields.CharField(max_length=20, default="draft", description="用例状态")
    is_ai_generated = fields.BooleanField(default=False, description="AI 生成标记")
    source_doc = fields.ForeignKeyField(
        "models.RequirementDoc",
        null=True,
        related_name="testcases",
        on_delete=fields.SET_NULL,
        description="来源需求文档",
    )
    source_function = fields.CharField(max_length=255, null=True, description="来源功能点")
    creator = fields.ForeignKeyField(
        "models.User",
        related_name="created_testcases",
        on_delete=fields.NO_ACTION,
        description="创建人",
    )
    maintainer = fields.ForeignKeyField(
        "models.User",
        null=True,
        related_name="maintained_testcases",
        on_delete=fields.SET_NULL,
        description="维护人",
    )

    suites: fields.ManyToManyRelation["TestSuite"]
    executions: fields.ReverseRelation["TestExecution"]

    class Meta:
        table = "testcase"
        table_description = "测试用例"
        unique_together = (("project_id", "code"),)
        indexes = (
            ("project_id", "status", "is_deleted"),
            ("module_id", "priority"),
            ("is_ai_generated",),
        )


class TestSuite(SoftDeleteMixin, TimestampMixin, Model):
    """测试套件表：用例组合，支持复用与排序"""

    id = fields.IntField(pk=True)
    project = fields.ForeignKeyField(
        "models.Project",
        related_name="suites",
        on_delete=fields.CASCADE,
        description="所属项目",
    )
    name = fields.CharField(max_length=128, description="套件名称")
    description = fields.TextField(null=True, description="套件描述")
    creator = fields.ForeignKeyField(
        "models.User",
        related_name="created_suites",
        on_delete=fields.NO_ACTION,
        description="创建人",
    )

    testcases: fields.ManyToManyRelation["TestCase"]
    suite_cases: fields.ReverseRelation["TestSuiteCase"]

    class Meta:
        table = "testsuite"
        table_description = "测试套件"
        indexes = (("project_id", "is_deleted"),)


class TestSuiteCase(Model):
    """套件-用例关联表（带排序）"""

    id = fields.IntField(pk=True, description="主键")
    suite = fields.ForeignKeyField(
        "models.TestSuite",
        related_name="suite_cases",
        on_delete=fields.CASCADE,
        description="所属套件",
    )
    testcase = fields.ForeignKeyField(
        "models.TestCase",
        related_name="testcase_suites",
        on_delete=fields.CASCADE,
        description="关联用例",
    )
    sort = fields.IntField(default=0, description="在套件中的排序")
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "testsuite_case"
        table_description = "套件-用例关联"
        unique_together = (("suite", "testcase"),)


class TestExecution(TimestampMixin, Model):
    """用例执行记录表：分析数据源"""

    id = fields.IntField(pk=True)
    testcase = fields.ForeignKeyField(
        "models.TestCase",
        related_name="executions",
        on_delete=fields.CASCADE,
        description="关联用例",
    )
    suite = fields.ForeignKeyField(
        "models.TestSuite",
        null=True,
        related_name="executions",
        on_delete=fields.SET_NULL,
        description="关联套件",
    )
    result = fields.CharField(max_length=20, description="执行结果: passed/failed/blocked/skipped")
    remark = fields.TextField(null=True, description="执行备注")
    defect_link = fields.CharField(max_length=255, null=True, description="关联缺陷链接")
    executed_by = fields.ForeignKeyField(
        "models.User",
        related_name="executions",
        on_delete=fields.NO_ACTION,
        description="执行人",
    )
    executed_at = fields.DatetimeField(description="执行时间")

    class Meta:
        table = "test_execution"
        table_description = "用例执行记录"
        indexes = (
            ("testcase_id", "executed_at"),
            ("result", "executed_at"),
            ("suite_id", "result"),
        )
