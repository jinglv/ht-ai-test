# Project ：backend
# File    ：router.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
用例域路由

包含：需求文档、测试用例、测试套件、执行记录
"""
from fastapi import APIRouter, Depends, Query, Request
from tortoise.expressions import Q

from hetu.core.deps import current_user, pagination
from hetu.core.exceptions import NotFoundError
from hetu.core.rbac import require_permission
from hetu.core.response import json_ok, paginated
from hetu.modules.testcase.models import TestCase, TestExecution, TestSuite, TestSuiteCase
from hetu.modules.testcase.schemas import (
    AIGenerateRequest,
    AIGenerateSaveRequest,
    AIGenerateTaskResponse,
    ExecutionStatsRequest,
    ExecutionStatsResponse,
    RequirementDocCreateRequest,
    RequirementDocSearchRequest,
    RequirementDocResponse,
    SuiteCaseAddRequest,
    SuiteCaseSortRequest,
    TestCaseBatchDeleteRequest,
    TestCaseBatchMoveRequest,
    TestCaseBatchPriorityRequest,
    TestCaseBatchStatusRequest,
    TestCaseCreateRequest,
    TestCaseResponse,
    TestCaseUpdateRequest,
    TestExecutionBatchRequest,
    TestExecutionCreateRequest,
    TestExecutionResponse,
    TestSuiteCreateRequest,
    TestSuiteResponse,
    TestSuiteUpdateRequest,
)
from hetu.modules.testcase.services import (
    add_cases_to_suite,
    batch_move_testcases,
    batch_update_priority,
    batch_update_status,
    create_execution,
    create_suite,
    create_testcase,
    delete_requirement_doc,
    delete_suite,
    delete_testcases,
    get_execution_stats,
    get_suite_by_id,
    get_suite_detail,
    list_executions,
    list_requirement_docs,
    list_suites,
    list_testcases,
    remove_case_from_suite,
    sort_suite_cases,
    update_suite,
    update_testcase,
)

testcase_router = APIRouter(prefix="/testcases", tags=["用例管理"])


# ===================================测试用例==================================

@testcase_router.get("", summary="用例列表")
async def list_testcases_api(
    request: Request,
    project_id: int | None = Query(None),
    module_id: int | None = Query(None),
    keyword: str | None = Query(None),
    priority: str | None = Query(None),
    case_type: str | None = Query(None),
    status: str | None = Query(None),
    is_ai_generated: bool | None = Query(None),
    creator_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ordering: str | None = Query(None, description="排序: -created_at,priority"),
    user: dict = Depends(require_permission("testcase:view")),
):
    """分页查询测试用例"""
    order_list = ordering.split(",") if ordering else None
    result = await list_testcases(
        project_id=project_id,
        module_id=module_id,
        keyword=keyword,
        priority=priority,
        case_type=case_type,
        status=status,
        is_ai_generated=is_ai_generated,
        creator_id=creator_id,
        page=page,
        page_size=page_size,
        ordering=order_list,
    )
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@testcase_router.get("/{case_id}", summary="用例详情")
async def get_testcase_detail(
    request: Request,
    case_id: int,
    user: dict = Depends(require_permission("testcase:view")),
):
    """获取单个用例详情"""
    tc = await get_testcase_by_id(case_id)
    if not tc:
        raise NotFoundError("测试用例不存在")

    return json_ok({
        "id": tc.id,
        "code": tc.code,
        "project_id": tc.project_id,
        "module_id": tc.module_id,
        "title": tc.title,
        "precondition": tc.precondition,
        "steps": tc.steps,
        "expected_result": tc.expected_result,
        "priority": tc.priority,
        "case_type": tc.case_type,
        "status": tc.status,
        "is_ai_generated": tc.is_ai_generated,
        "source_doc_id": tc.source_doc_id,
        "source_function": tc.source_function,
        "creator_id": tc.creator_id,
        "maintainer_id": tc.maintainer_id,
        "created_at": tc.created_at.isoformat() if tc.created_at else None,
    })


@testcase_router.post("", summary="创建用例")
async def create_testcase_api(
    request: Request,
    body: TestCaseCreateRequest,
    user: dict = Depends(require_permission("testcase:create")),
):
    """创建测试用例"""
    tc = await create_testcase(
        project_id=body.project_id,
        title=body.title,
        creator_id=user["user_id"],
        module_id=body.module_id,
        precondition=body.precondition,
        steps=body.steps,
        expected_result=body.expected_result,
        priority=body.priority,
        case_type=body.case_type,
        status="draft",
        source_doc_id=body.source_doc_id,
        source_function=body.source_function,
    )
    return json_ok({"id": tc.id, "code": tc.code}, "创建成功")


@testcase_router.put("/{case_id}", summary="更新用例")
async def update_testcase_api(
    request: Request,
    case_id: int,
    body: TestCaseUpdateRequest,
    user: dict = Depends(require_permission("testcase:create")),
):
    """更新测试用例"""
    update_data = body.model_dump(exclude_none=True)
    tc = await update_testcase(case_id, **update_data)
    return json_ok({"id": tc.id}, "更新成功")


@testcase_router.delete("/{case_id}", summary="删除用例")
async def delete_testcase_api(
    request: Request,
    case_id: int,
    user: dict = Depends(require_permission("testcase:create")),
):
    """删除测试用例（软删除）"""
    await delete_testcases([case_id])
    return json_ok(message="删除成功")


@testcase_router.post("/batch", summary="批量操作")
async def batch_testcases_api(
    request: Request,
    action: str = Query(description="操作类型: delete/move/status/priority"),
    body: dict = {},
    user: dict = Depends(require_permission("testcase:create")),
):
    """批量操作测试用例"""
    ids = body.get("ids", [])
    if not ids:
        raise ValidationError("ids 不能为空")

    if action == "delete":
        count = await delete_testcases(ids)
        return json_ok({"deleted": count}, "批量删除成功")
    elif action == "move":
        module_id = body.get("module_id")
        count = await batch_move_testcases(ids, module_id)
        return json_ok({"moved": count}, "批量移动成功")
    elif action == "status":
        status = body.get("status")
        if not status:
            raise ValidationError("status 不能为空")
        count = await batch_update_status(ids, status)
        return json_ok({"updated": count}, "批量更新状态成功")
    elif action == "priority":
        priority = body.get("priority")
        if not priority:
            raise ValidationError("priority 不能为空")
        count = await batch_update_priority(ids, priority)
        return json_ok({"updated": count}, "批量更新优先级成功")
    else:
        raise ValidationError(f"不支持的操作: {action}")


# ===================================测试套件==================================
suites_router = APIRouter(prefix="/testsuites", tags=["测试套件"])


@suites_router.get("", summary="套件列表")
async def list_suites_api(
    request: Request,
    project_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission("testcase:view")),
):
    """分页查询测试套件"""
    result = await list_suites(project_id, page, page_size)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@suites_router.get("/{suite_id}", summary="套件详情")
async def get_suite_detail_api(
    request: Request,
    suite_id: int,
    user: dict = Depends(require_permission("testcase:view")),
):
    """获取套件详情（含用例列表）"""
    data = await get_suite_detail(suite_id)
    return json_ok(data)


@suites_router.post("", summary="创建套件")
async def create_suite_api(
    request: Request,
    body: TestSuiteCreateRequest,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """创建测试套件"""
    suite = await create_suite(
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        creator_id=user["user_id"],
    )
    return json_ok({"id": suite.id}, "创建成功")


@suites_router.put("/{suite_id}", summary="更新套件")
async def update_suite_api(
    request: Request,
    suite_id: int,
    body: TestSuiteUpdateRequest,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """更新测试套件"""
    update_data = body.model_dump(exclude_none=True)
    suite = await update_suite(suite_id, **update_data)
    return json_ok({"id": suite.id}, "更新成功")


@suites_router.delete("/{suite_id}", summary="删除套件")
async def delete_suite_api(
    request: Request,
    suite_id: int,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """删除测试套件"""
    await delete_suite(suite_id)
    return json_ok(message="删除成功")


@suites_router.post("/{suite_id}/cases", summary="添加用例到套件")
async def add_cases_to_suite_api(
    request: Request,
    suite_id: int,
    body: SuiteCaseAddRequest,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """添加用例到套件"""
    added = await add_cases_to_suite(suite_id, body.testcase_ids)
    return json_ok({"added": added}, "添加成功")


@suites_router.delete("/{suite_id}/cases/{case_id}", summary="移除套件用例")
async def remove_case_from_suite_api(
    request: Request,
    suite_id: int,
    case_id: int,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """从套件移除用例"""
    await remove_case_from_suite(suite_id, case_id)
    return json_ok(message="移除成功")


@suites_router.put("/{suite_id}/cases/sort", summary="套件用例排序")
async def sort_suite_cases_api(
    request: Request,
    suite_id: int,
    body: SuiteCaseSortRequest,
    user: dict = Depends(require_permission("testsuite:manage")),
):
    """套件内用例排序"""
    await sort_suite_cases(suite_id, body.items)
    return json_ok(message="排序成功")


# ===================================需求文档==================================
requirements_router = APIRouter(prefix="/requirements", tags=["需求文档"])


@requirements_router.post("/upload", summary="上传需求文档")
async def upload_requirement_doc_api(
    request: Request,
    body: RequirementDocCreateRequest,
    user: dict = Depends(require_permission("requirement:upload")),
):
    """上传需求文档"""
    doc = await upload_requirement_doc(
        project_id=body.project_id,
        uploaded_by_id=user["user_id"],
        title=body.title,
        file_type=body.file_type,
        content=body.content,
        file_url=body.file_url,
        file_size=body.file_size,
    )
    return json_ok({"id": doc.id}, "上传成功")


@requirements_router.get("", summary="需求文档列表")
async def list_requirement_docs_api(
    request: Request,
    project_id: int | None = Query(None),
    keyword: str | None = Query(None),
    file_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission("testcase:view")),
):
    """分页查询需求文档"""
    result = await list_requirement_docs(project_id, keyword, file_type, page, page_size)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@requirements_router.get("/{doc_id}", summary="需求文档详情")
async def get_requirement_doc_detail(
    request: Request,
    doc_id: int,
    user: dict = Depends(require_permission("testcase:view")),
):
    """获取需求文档详情"""
    doc = await get_doc_by_id(doc_id)
    if not doc:
        raise NotFoundError("需求文档不存在")
    return json_ok({
        "id": doc.id,
        "project_id": doc.project_id,
        "title": doc.title,
        "file_type": doc.file_type,
        "file_url": doc.file_url,
        "file_size": doc.file_size,
        "content": doc.content,
        "uploaded_by_id": doc.uploaded_by_id,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    })


@requirements_router.get("/search", summary="全文检索需求文档")
async def search_requirement_docs(
    request: Request,
    project_id: int = Query(description="项目 ID"),
    keyword: str = Query(min_length=1, description="检索关键词"),
    user: dict = Depends(require_permission("testcase:view")),
):
    """全文检索需求文档内容"""
    result = await list_requirement_docs(project_id=project_id, keyword=keyword)
    return json_ok(result["items"])


@requirements_router.delete("/{doc_id}", summary="删除需求文档")
async def delete_requirement_doc_api(
    request: Request,
    doc_id: int,
    user: dict = Depends(require_permission("requirement:upload")),
):
    """删除需求文档（软删除）"""
    await delete_requirement_doc(doc_id)
    return json_ok(message="删除成功")


# ===================================执行记录==================================
executions_router = APIRouter(prefix="/test-executions", tags=["执行记录"])


@executions_router.get("", summary="执行记录列表")
async def list_executions_api(
    request: Request,
    project_id: int | None = Query(None),
    testcase_id: int | None = Query(None),
    suite_id: int | None = Query(None),
    result: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission("testcase:view")),
):
    """分页查询执行记录"""
    result_data = await list_executions(project_id, testcase_id, suite_id, result, page, page_size)
    return json_ok(paginated(result_data["items"], result_data["total"], result_data["page"], result_data["page_size"]))


@executions_router.post("", summary="创建执行记录")
async def create_execution_api(
    request: Request,
    body: TestExecutionCreateRequest,
    user: dict = Depends(require_permission("testcase:create")),
):
    """创建执行记录"""
    ex = await create_execution(
        testcase_id=body.testcase_id,
        result=body.result,
        executed_by_id=user["user_id"],
        suite_id=body.suite_id,
        remark=body.remark,
        defect_link=body.defect_link,
        executed_at=body.executed_at,
    )
    return json_ok({"id": ex.id}, "记录成功")


@executions_router.post("/batch", summary="批量创建执行记录")
async def batch_create_executions_api(
    request: Request,
    body: TestExecutionBatchRequest,
    user: dict = Depends(require_permission("testcase:create")),
):
    """批量创建执行记录"""
    items = [item.model_dump() for item in body.items]
    executions = await batch_create_executions(items, user["user_id"])
    return json_ok({"count": len(executions)}, "批量记录成功")


@executions_router.get("/stats", summary="执行统计")
async def get_execution_stats_api(
    request: Request,
    project_id: int | None = Query(None),
    group_by: str = Query("result", description="分组: result/date/executor"),
    user: dict = Depends(require_permission("testcase:view")),
):
    """执行统计"""
    stats = await get_execution_stats(project_id=project_id, group_by=group_by)
    return json_ok(stats)


# ===================================AI 生成用例==================================
ai_generate_router = APIRouter(prefix="/testcases/ai-generate", tags=["AI 用例生成"])


@ai_generate_router.post("", summary="发起 AI 用例生成")
async def ai_generate_cases(
    request: Request,
    body: AIGenerateRequest,
    user: dict = Depends(require_permission("testcase:ai_generate")),
):
    """发起 AI 用例生成任务（异步）"""
    # TODO: 接入 hetu_agent 异步任务队列
    # 当前返回模拟任务
    return json_ok({
        "task_id": 1,
        "status": "pending",
        "message": "任务已创建，请轮询状态",
    }, "任务已创建")


@ai_generate_router.get("/{task_id}", summary="查询生成任务状态")
async def get_ai_generate_status(
    request: Request,
    task_id: int,
    user: dict = Depends(require_permission("testcase:ai_generate")),
):
    """查询 AI 用例生成任务状态"""
    return json_ok({
        "task_id": task_id,
        "status": "success",
        "generated_count": 3,
        "saved_count": 0,
        "result_preview": [
            {"title": "测试用例 1", "priority": "P1"},
            {"title": "测试用例 2", "priority": "P2"},
        ],
    })


@ai_generate_router.post("/{task_id}/save", summary="保存 AI 生成的用例")
async def save_ai_generated_cases(
    request: Request,
    task_id: int,
    body: AIGenerateSaveRequest,
    user: dict = Depends(require_permission("testcase:create")),
):
    """确认保存 AI 生成的用例"""
    # TODO: 实际保存逻辑
    return json_ok({"saved": len(body.case_ids)}, "保存成功")


@ai_generate_router.post("/{task_id}/cancel", summary="取消生成任务")
async def cancel_ai_generate_task(
    request: Request,
    task_id: int,
    user: dict = Depends(require_permission("testcase:ai_generate")),
):
    """取消 AI 用例生成任务"""
    return json_ok(message="任务已取消")
