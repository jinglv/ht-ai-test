# Project ：backend
# File    ：schemas.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
用例域请求/响应 DTO
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from hetu.shared.enums import CaseStatus, CaseType, DocFileType, ExecutionResult, Priority


# ===================================需求文档==================================
class RequirementDocCreateRequest(BaseModel):
    """上传需求文档"""

    project_id: int = Field(description="所属项目 ID")
    title: str = Field(min_length=1, max_length=255, description="文档标题")
    file_type: str = Field(description="文件类型: markdown/word/pdf/text")
    content: Optional[str] = Field(None, description="解析后的文本内容")
    file_url: Optional[str] = Field(None, max_length=255, description="文件存储路径")
    file_size: Optional[int] = Field(None, description="文件大小(字节)")


class RequirementDocResponse(BaseModel):
    """需求文档响应"""

    id: int
    project_id: int
    title: str
    file_type: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_by_id: int
    content_preview: Optional[str] = None
    created_at: Optional[datetime] = None


class RequirementDocSearchRequest(BaseModel):
    """全文检索需求"""

    project_id: int = Field(description="项目 ID")
    keyword: str = Field(min_length=1, description="检索关键词")
    file_type: Optional[str] = Field(None, description="筛选文件类型")


# ===================================测试用例==================================
class TestCaseCreateRequest(BaseModel):
    """创建测试用例"""

    project_id: int = Field(description="所属项目 ID")
    module_id: Optional[int] = Field(None, description="所属模块 ID")
    title: str = Field(min_length=1, max_length=255, description="用例标题")
    precondition: Optional[str] = Field(None, description="前置条件")
    steps: list[dict] = Field(default_factory=list, description="测试步骤列表")
    expected_result: Optional[str] = Field(None, description="预期结果")
    priority: str = Field(default="P2", description="优先级")
    case_type: str = Field(default="functional", description="用例类型")
    source_doc_id: Optional[int] = Field(None, description="来源需求文档 ID")
    source_function: Optional[str] = Field(None, description="来源功能点")


class TestCaseUpdateRequest(BaseModel):
    """更新测试用例"""

    title: Optional[str] = Field(None, max_length=255)
    module_id: Optional[int] = None
    precondition: Optional[str] = None
    steps: Optional[list[dict]] = None
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None
    source_doc_id: Optional[int] = None
    source_function: Optional[str] = None
    maintainer_id: Optional[int] = None


class TestCaseResponse(BaseModel):
    """测试用例响应"""

    id: int
    code: str
    project_id: int
    module_id: Optional[int] = None
    title: str
    precondition: Optional[str] = None
    steps: list[dict] = []
    expected_result: Optional[str] = None
    priority: str
    case_type: str
    status: str
    is_ai_generated: bool
    source_doc_id: Optional[int] = None
    source_function: Optional[str] = None
    creator_id: int
    maintainer_id: Optional[int] = None
    created_at: Optional[datetime] = None


class TestCaseBatchDeleteRequest(BaseModel):
    """批量删除用例"""

    ids: list[int] = Field(min_length=1, description="用例 ID 列表")


class TestCaseBatchMoveRequest(BaseModel):
    """批量移动用例"""

    ids: list[int] = Field(min_length=1, description="用例 ID 列表")
    module_id: Optional[int] = Field(None, description="目标模块 ID")


class TestCaseBatchStatusRequest(BaseModel):
    """批量变更状态"""

    ids: list[int] = Field(min_length=1, description="用例 ID 列表")
    status: str = Field(description="目标状态")


class TestCaseBatchPriorityRequest(BaseModel):
    """批量变更优先级"""

    ids: list[int] = Field(min_length=1, description="用例 ID 列表")
    priority: str = Field(description="目标优先级")


# ===================================测试套件==================================
class TestSuiteCreateRequest(BaseModel):
    """创建测试套件"""

    project_id: int = Field(description="所属项目 ID")
    name: str = Field(min_length=1, max_length=128, description="套件名称")
    description: Optional[str] = Field(None, description="套件描述")


class TestSuiteUpdateRequest(BaseModel):
    """更新测试套件"""

    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None


class TestSuiteResponse(BaseModel):
    """测试套件响应"""

    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    creator_id: int
    case_count: int = 0
    cases: list[dict] = []
    created_at: Optional[datetime] = None


class SuiteCaseAddRequest(BaseModel):
    """添加用例到套件"""

    testcase_ids: list[int] = Field(min_length=1, description="用例 ID 列表")


class SuiteCaseSortRequest(BaseModel):
    """套件内用例排序"""

    items: list[dict] = Field(description="排序项 [{testcase_id, sort}]")


# ===================================执行记录==================================
class TestExecutionCreateRequest(BaseModel):
    """创建执行记录"""

    testcase_id: int = Field(description="关联用例 ID")
    suite_id: Optional[int] = Field(None, description="关联套件 ID")
    result: str = Field(description="执行结果: passed/failed/blocked/skipped")
    remark: Optional[str] = Field(None, description="执行备注")
    defect_link: Optional[str] = Field(None, max_length=255, description="缺陷链接")
    executed_at: Optional[datetime] = Field(None, description="执行时间")


class TestExecutionBatchRequest(BaseModel):
    """批量执行记录"""

    items: list[TestExecutionCreateRequest] = Field(min_length=1)


class TestExecutionResponse(BaseModel):
    """执行记录响应"""

    id: int
    testcase_id: int
    testcase_code: Optional[str] = None
    testcase_title: Optional[str] = None
    suite_id: Optional[int] = None
    result: str
    remark: Optional[str] = None
    defect_link: Optional[str] = None
    executed_by_id: int
    executed_by_name: Optional[str] = None
    executed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ExecutionStatsRequest(BaseModel):
    """执行统计请求"""

    group_by: str = Field(default="result", description="分组维度: result/date/module/executor")
    project_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ExecutionStatsResponse(BaseModel):
    """执行统计响应"""

    group_by: str
    groups: list[dict] = []
    total: int = 0
    passed: int = 0
    failed: int = 0
    blocked: int = 0
    skipped: int = 0
    pass_rate: float = 0.0


# ===================================AI 生成==================================
class AIGenerateRequest(BaseModel):
    """AI 生成用例请求"""

    project_id: int = Field(description="目标项目 ID")
    module_id: Optional[int] = Field(None, description="目标模块 ID")
    source_doc_id: Optional[int] = Field(None, description="来源需求文档 ID")
    prompt: str = Field(min_length=1, description="用户指令/需求描述")


class AIGenerateTaskResponse(BaseModel):
    """AI 生成任务响应"""

    task_id: int
    status: str
    generated_count: int = 0
    saved_count: int = 0
    result_preview: Optional[list] = None
    error_message: Optional[str] = None


class AIGenerateSaveRequest(BaseModel):
    """保存 AI 生成的用例"""

    case_ids: list[int] = Field(min_length=1, description="待保存的用例 ID 列表")
    status: str = Field(default="draft", description="保存后的状态")
