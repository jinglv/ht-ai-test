# Project ：backend
# File    ：services.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
用例域业务逻辑服务层

包含：需求文档 CRUD、测试用例 CRUD+批量操作、测试套件 CRUD、执行记录 CRUD+统计。
"""
import uuid
from datetime import datetime
from typing import Any

from loguru import logger
from tortoise.expressions import Q

from hetu.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from hetu.core.rbac import apply_data_scope_filter, get_data_scope, get_user_project_ids
from hetu.shared.enums import DataScope
from hetu.modules.project.models import Project, ProjectModule
from hetu.modules.rbac.models import User
from hetu.modules.testcase.models import (
    RequirementDoc,
    TestCase,
    TestExecution,
    TestSuite,
    TestSuiteCase,
)


# ===================================需求文档服务==================================
async def get_doc_by_id(doc_id: int) -> RequirementDoc | None:
    """根据 ID 获取需求文档"""
    return await RequirementDoc.get_or_none(id=doc_id, is_deleted=False)


async def upload_requirement_doc(
    project_id: int,
    uploaded_by_id: int,
    title: str,
    file_type: str,
    content: str | None = None,
    file_url: str | None = None,
    file_size: int | None = None,
) -> RequirementDoc:
    """上传需求文档"""
    project = await Project.get_or_none(id=project_id)
    if not project:
        raise NotFoundError("项目不存在")

    doc = await RequirementDoc.create(
        project_id=project_id,
        title=title,
        content=content,
        file_type=file_type,
        file_url=file_url,
        file_size=file_size,
        uploaded_by_id=uploaded_by_id,
    )
    logger.info(f"上传需求文档: {title} (项目: {project_id})")
    return doc


async def list_requirement_docs(
    project_id: int | None = None,
    keyword: str | None = None,
    file_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user: dict | None = None,
) -> dict:
    """分页查询需求文档"""
    qs = RequirementDoc.filter(is_deleted=False)

    # 数据权限过滤：需求文档以 project_id 关联项目
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            qs = qs.filter(uploaded_by_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(project_id__in=project_ids)
            else:
                return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if project_id:
        qs = qs.filter(project_id=project_id)
    if keyword:
        qs = qs.filter(Q(title__icontains=keyword) | Q(content__icontains=keyword))
    if file_type:
        qs = qs.filter(file_type=file_type)

    total = await qs.count()
    offset = (page - 1) * page_size
    docs = await qs.offset(offset).limit(page_size).all().prefetch_related("uploaded_by", "project")

    items = []
    for d in docs:
        items.append({
            "id": d.id,
            "project_id": d.project_id,
            "project_name": d.project.name if d.project else "",
            "title": d.title,
            "file_type": d.file_type,
            "file_url": d.file_url,
            "file_size": d.file_size,
            "uploaded_by_id": d.uploaded_by_id,
            "uploaded_by_name": d.uploaded_by.real_name if d.uploaded_by else "",
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def delete_requirement_doc(doc_id: int) -> None:
    """删除需求文档（软删除）"""
    doc = await get_doc_by_id(doc_id)
    if not doc:
        raise NotFoundError("需求文档不存在")
    await doc.soft_delete()
    logger.info(f"删除需求文档: id={doc_id}")


# ===================================测试用例服务==================================
async def get_testcase_by_id(testcase_id: int) -> TestCase | None:
    """根据 ID 获取测试用例"""
    return await TestCase.get_or_none(id=testcase_id, is_deleted=False)


async def generate_case_code(project_id: int) -> str:
    """生成用例编号 TC-{项目编号}-{序号}"""
    project = await Project.get_or_none(id=project_id)
    if not project:
        raise NotFoundError("项目不存在")

    # 获取当前项目最大序号
    last = await TestCase.filter(project_id=project_id).order_by("-id").first()
    seq = 1
    if last and last.code:
        parts = last.code.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            seq = int(parts[1]) + 1

    return f"TC-{project.code}-{seq:04d}"


async def create_testcase(
    project_id: int,
    title: str,
    creator_id: int,
    module_id: int | None = None,
    precondition: str | None = None,
    steps: list[dict] | None = None,
    expected_result: str | None = None,
    priority: str = "P2",
    case_type: str = "functional",
    status: str = "draft",
    source_doc_id: int | None = None,
    source_function: str | None = None,
    is_ai_generated: bool = False,
) -> TestCase:
    """创建测试用例"""
    project = await Project.get_or_none(id=project_id)
    if not project:
        raise NotFoundError("项目不存在")

    code = await generate_case_code(project_id)

    testcase = await TestCase.create(
        code=code,
        project_id=project_id,
        module_id=module_id,
        title=title,
        precondition=precondition,
        steps=steps or [],
        expected_result=expected_result,
        priority=priority,
        case_type=case_type,
        status=status,
        is_ai_generated=is_ai_generated,
        source_doc_id=source_doc_id,
        source_function=source_function,
        creator_id=creator_id,
    )
    logger.info(f"创建用例: {code} - {title}")
    return testcase


async def update_testcase(testcase_id: int, **kwargs) -> TestCase:
    """更新测试用例"""
    testcase = await get_testcase_by_id(testcase_id)
    if not testcase:
        raise NotFoundError("测试用例不存在")

    for key, value in kwargs.items():
        if hasattr(testcase, key):
            setattr(testcase, key, value)

    await testcase.save()
    logger.info(f"更新用例: {testcase.code}")
    return testcase


async def delete_testcases(ids: list[int]) -> int:
    """批量删除用例（软删除）"""
    count = 0
    for tc_id in ids:
        tc = await get_testcase_by_id(tc_id)
        if tc:
            await tc.soft_delete()
            count += 1
    logger.info(f"批量删除用例: {count} 条")
    return count


async def list_testcases(
    project_id: int | None = None,
    module_id: int | None = None,
    keyword: str | None = None,
    priority: str | None = None,
    case_type: str | None = None,
    status: str | None = None,
    is_ai_generated: bool | None = None,
    creator_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    ordering: list[str] | None = None,
    user: dict | None = None,
) -> dict:
    """分页查询测试用例"""
    qs = TestCase.filter(is_deleted=False)

    # 数据权限过滤
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            qs = qs.filter(creator_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(project_id__in=project_ids)
            else:
                return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if project_id:
        qs = qs.filter(project_id=project_id)
    if module_id:
        # 包含子模块用例
        child_modules = await ProjectModule.filter(parent_id=module_id).values_list("id", flat=True)
        module_ids = [module_id] + list(child_modules)
        qs = qs.filter(module_id__in=module_ids)
    if keyword:
        qs = qs.filter(Q(title__icontains=keyword) | Q(code__icontains=keyword))
    if priority:
        qs = qs.filter(priority=priority)
    if case_type:
        qs = qs.filter(case_type=case_type)
    if status:
        qs = qs.filter(status=status)
    if is_ai_generated is not None:
        qs = qs.filter(is_ai_generated=is_ai_generated)
    if creator_id:
        qs = qs.filter(creator_id=creator_id)

    # 排序
    if ordering:
        order_fields = []
        for f in ordering:
            if f.startswith("-"):
                order_fields.append(f)
            else:
                order_fields.append(f)
        qs = qs.order_by(*order_fields)

    total = await qs.count()
    offset = (page - 1) * page_size
    cases = await qs.offset(offset).limit(page_size).all().prefetch_related("module", "creator", "maintainer")

    items = []
    for tc in cases:
        module_name = tc.module.name if tc.module else ""
        creator_name = tc.creator.real_name if tc.creator else ""
        maintainer_name = tc.maintainer.real_name if tc.maintainer else ""
        items.append({
            "id": tc.id,
            "code": tc.code,
            "project_id": tc.project_id,
            "module_id": tc.module_id,
            "module_name": module_name,
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
            "creator_name": creator_name,
            "maintainer_id": tc.maintainer_id,
            "maintainer_name": maintainer_name,
            "created_at": tc.created_at.isoformat() if tc.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def batch_move_testcases(ids: list[int], module_id: int | None) -> int:
    """批量移动用例"""
    count = 0
    for tc_id in ids:
        tc = await get_testcase_by_id(tc_id)
        if tc:
            tc.module_id = module_id
            await tc.save(update_fields=["module_id"])
            count += 1
    return count


async def batch_update_status(ids: list[int], status: str) -> int:
    """批量变更状态"""
    count = 0
    for tc_id in ids:
        tc = await get_testcase_by_id(tc_id)
        if tc:
            tc.status = status
            await tc.save(update_fields=["status"])
            count += 1
    return count


async def batch_update_priority(ids: list[int], priority: str) -> int:
    """批量变更优先级"""
    count = 0
    for tc_id in ids:
        tc = await get_testcase_by_id(tc_id)
        if tc:
            tc.priority = priority
            await tc.save(update_fields=["priority"])
            count += 1
    return count


# ===================================测试套件服务==================================
async def get_suite_by_id(suite_id: int) -> TestSuite | None:
    """根据 ID 获取测试套件"""
    return await TestSuite.get_or_none(id=suite_id, is_deleted=False)


async def create_suite(project_id: int, name: str, description: str | None, creator_id: int) -> TestSuite:
    """创建测试套件"""
    project = await Project.get_or_none(id=project_id)
    if not project:
        raise NotFoundError("项目不存在")

    suite = await TestSuite.create(
        project_id=project_id,
        name=name,
        description=description,
        creator_id=creator_id,
    )
    logger.info(f"创建套件: {name}")
    return suite


async def update_suite(suite_id: int, **kwargs) -> TestSuite:
    """更新测试套件"""
    suite = await get_suite_by_id(suite_id)
    if not suite:
        raise NotFoundError("测试套件不存在")

    for key, value in kwargs.items():
        if hasattr(suite, key):
            setattr(suite, key, value)

    await suite.save()
    return suite


async def delete_suite(suite_id: int) -> None:
    """删除测试套件"""
    suite = await get_suite_by_id(suite_id)
    if not suite:
        raise NotFoundError("测试套件不存在")
    await suite.soft_delete()
    logger.info(f"删除套件: {suite.name}")


async def add_cases_to_suite(suite_id: int, testcase_ids: list[int]) -> int:
    """添加用例到套件"""
    suite = await get_suite_by_id(suite_id)
    if not suite:
        raise NotFoundError("测试套件不存在")

    # 获取当前最大排序
    existing_count = await TestSuiteCase.filter(suite_id=suite_id).count()
    added = 0
    for idx, tc_id in enumerate(testcase_ids):
        tc = await get_testcase_by_id(tc_id)
        if not tc:
            continue
        # 检查是否已存在
        existing = await TestSuiteCase.get_or_none(suite_id=suite_id, testcase_id=tc_id)
        if existing:
            continue
        await TestSuiteCase.create(suite_id=suite_id, testcase_id=tc_id, sort=existing_count + idx)
        added += 1
    logger.info(f"添加用例到套件: suite_id={suite_id}, 新增 {added} 条")
    return added


async def remove_case_from_suite(suite_id: int, testcase_id: int) -> None:
    """从套件移除用例"""
    link = await TestSuiteCase.get_or_none(suite_id=suite_id, testcase_id=testcase_id)
    if not link:
        raise NotFoundError("用例不在套件中")
    await link.delete()


async def sort_suite_cases(suite_id: int, items: list[dict]) -> None:
    """排序套件内用例"""
    suite = await get_suite_by_id(suite_id)
    if not suite:
        raise NotFoundError("测试套件不存在")

    for item in items:
        testcase_id = item.get("testcase_id")
        sort = item.get("sort", 0)
        link = await TestSuiteCase.get_or_none(suite_id=suite_id, testcase_id=testcase_id)
        if link:
            link.sort = sort
            await link.save(update_fields=["sort"])


async def list_suites(
    project_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    user: dict | None = None,
) -> dict:
    """分页查询测试套件"""
    qs = TestSuite.filter(is_deleted=False)

    # 数据权限过滤
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            qs = qs.filter(creator_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(project_id__in=project_ids)
            else:
                return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if project_id:
        qs = qs.filter(project_id=project_id)

    total = await qs.count()
    offset = (page - 1) * page_size
    suites = await qs.offset(offset).limit(page_size).all().prefetch_related("creator")

    items = []
    for s in suites:
        case_count = await s.suite_cases.all().count()
        creator_name = s.creator.real_name if s.creator else ""
        items.append({
            "id": s.id,
            "project_id": s.project_id,
            "name": s.name,
            "description": s.description,
            "creator_id": s.creator_id,
            "creator_name": creator_name,
            "case_count": case_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_suite_detail(suite_id: int) -> dict:
    """获取套件详情（含用例列表）"""
    suite = await get_suite_by_id(suite_id)
    if not suite:
        raise NotFoundError("测试套件不存在")

    links = await TestSuiteCase.filter(suite_id=suite_id).order_by("sort").prefetch_related("testcase")
    cases = []
    for link in links:
        tc = link.testcase
        if tc:
            cases.append({
                "testcase_id": tc.id,
                "code": tc.code,
                "title": tc.title,
                "priority": tc.priority,
                "status": tc.status,
                "sort": link.sort,
            })

    creator_name = (await suite.creator).real_name if suite.creator else ""
    return {
        "id": suite.id,
        "project_id": suite.project_id,
        "name": suite.name,
        "description": suite.description,
        "creator_id": suite.creator_id,
        "creator_name": creator_name,
        "cases": cases,
        "created_at": suite.created_at.isoformat() if suite.created_at else None,
    }


# ===================================执行记录服务==================================
async def create_execution(
    testcase_id: int,
    result: str,
    executed_by_id: int,
    suite_id: int | None = None,
    remark: str | None = None,
    defect_link: str | None = None,
    executed_at: datetime | None = None,
) -> TestExecution:
    """创建执行记录"""
    tc = await get_testcase_by_id(testcase_id)
    if not tc:
        raise NotFoundError("测试用例不存在")

    if executed_at is None:
        executed_at = datetime.now()

    execution = await TestExecution.create(
        testcase_id=testcase_id,
        suite_id=suite_id,
        result=result,
        remark=remark,
        defect_link=defect_link,
        executed_by_id=executed_by_id,
        executed_at=executed_at,
    )
    logger.info(f"创建执行记录: testcase_id={testcase_id}, result={result}")
    return execution


async def batch_create_executions(items: list[dict], executed_by_id: int) -> list[TestExecution]:
    """批量创建执行记录"""
    executions = []
    for item in items:
        ex = await create_execution(
            testcase_id=item["testcase_id"],
            result=item["result"],
            executed_by_id=executed_by_id,
            suite_id=item.get("suite_id"),
            remark=item.get("remark"),
            defect_link=item.get("defect_link"),
            executed_at=item.get("executed_at"),
        )
        executions.append(ex)
    return executions


async def list_executions(
    project_id: int | None = None,
    testcase_id: int | None = None,
    suite_id: int | None = None,
    result: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user: dict | None = None,
) -> dict:
    """分页查询执行记录"""
    qs = TestExecution.all()

    # 数据权限过滤：执行记录通过 testcase 关联项目
    # SELF 范围：仅显示当前用户创建的用例的执行记录（testcase.creator_id）
    # PROJECT 范围：显示用户所属项目的所有执行记录
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            # 通过 testcase 关联 creator_id
            qs = qs.filter(testcase__creator_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(testcase__project_id__in=project_ids)
            else:
                return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if project_id:
        qs = qs.filter(testcase__project_id=project_id)
    if testcase_id:
        qs = qs.filter(testcase_id=testcase_id)
    if suite_id:
        qs = qs.filter(suite_id=suite_id)
    if result:
        qs = qs.filter(result=result)

    qs = qs.order_by("-executed_at")
    total = await qs.count()
    offset = (page - 1) * page_size
    executions = await qs.offset(offset).limit(page_size).all().prefetch_related(
        "testcase", "executed_by"
    )

    items = []
    for ex in executions:
        items.append({
            "id": ex.id,
            "testcase_id": ex.testcase_id,
            "testcase_code": ex.testcase.code if ex.testcase else "",
            "testcase_title": ex.testcase.title if ex.testcase else "",
            "suite_id": ex.suite_id,
            "result": ex.result,
            "remark": ex.remark,
            "defect_link": ex.defect_link,
            "executed_by_id": ex.executed_by_id,
            "executed_by_name": ex.executed_by.real_name if ex.executed_by else "",
            "executed_at": ex.executed_at.isoformat() if ex.executed_at else None,
            "created_at": ex.created_at.isoformat() if ex.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_execution_stats(
    project_id: int | None = None,
    group_by: str = "result",
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    user: dict | None = None,
) -> dict:
    """执行统计"""
    from tortoise.expressions import Sum, Count

    qs = TestExecution.all()

    # 数据权限过滤
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            qs = qs.filter(executed_by_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(testcase__project_id__in=project_ids)
            else:
                return {
                    "group_by": group_by,
                    "groups": [],
                    "total": 0, "passed": 0, "failed": 0, "blocked": 0, "skipped": 0,
                    "pass_rate": 0.0,
                }

    if project_id:
        qs = qs.filter(testcase__project_id=project_id)
    if start_date:
        qs = qs.filter(executed_at__gte=start_date)
    if end_date:
        qs = qs.filter(executed_at__lte=end_date)

    total = await qs.count()
    passed = await qs.filter(result="passed").count()
    failed = await qs.filter(result="failed").count()
    blocked = await qs.filter(result="blocked").count()
    skipped = await qs.filter(result="skipped").count()
    pass_rate = (passed / total * 100) if total > 0 else 0.0

    # 分组统计
    groups = []
    if group_by == "result":
        for r in ["passed", "failed", "blocked", "skipped"]:
            count = await qs.filter(result=r).count()
            groups.append({"name": r, "count": count})
    elif group_by == "date":
        # 按日期分组
        from tortoise.functions import TruncDate
        rows = await qs.annotate(date=TruncDate("executed_at")).group_by("date").values("date").order_by("date")
        for row in rows:
            date_str = row["date"].strftime("%Y-%m-%d") if row["date"] else ""
            count = await qs.filter(executed_at__date=row["date"]).count()
            groups.append({"name": date_str, "count": count})
    elif group_by == "executor":
        from tortoise.functions import Count
        rows = await qs.all().prefetch_related("executed_by")
        executor_map: dict[int, dict] = {}
        for ex in rows:
            uid = ex.executed_by_id
            if uid not in executor_map:
                executor_map[uid] = {"name": ex.executed_by.real_name if ex.executed_by else f"用户{uid}", "count": 0}
            executor_map[uid]["count"] += 1
        groups = list(executor_map.values())

    return {
        "group_by": group_by,
        "groups": groups,
        "total": total,
        "passed": passed,
        "failed": failed,
        "blocked": blocked,
        "skipped": skipped,
        "pass_rate": round(pass_rate, 1),
    }
