# Project ：backend
# File    ：enums.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
共享枚举定义

所有业务域通用的枚举类型集中在此定义，供模型与 schema 复用。
"""
import enum


class PermissionType(str, enum.Enum):
    """权限类型"""

    MENU = "menu"       # 菜单权限：控制左侧菜单/Tab 可见性
    ACTION = "action"   # 操作权限：控制按钮级操作，格式 domain:action
    DATA = "data"       # 数据权限：数据行可见范围（与 role.data_scope 配合）


class DataScope(str, enum.Enum):
    """数据权限范围（绑定在角色上，多角色取最大：ALL > PROJECT > SELF）"""

    SELF = "self"       # 仅本人：creator_id / owner_id = 当前用户
    PROJECT = "project" # 本项目：project_id IN 当前用户所属项目集合
    ALL = "all"         # 全部：不过滤


class ProjectStatus(str, enum.Enum):
    """项目状态"""

    PLANNING = "planning"       # 规划中
    IN_PROGRESS = "in_progress" # 进行中
    COMPLETED = "completed"     # 已完成
    ARCHIVED = "archived"       # 已归档（只读）


class ProjectRole(str, enum.Enum):
    """项目内成员角色"""

    OWNER = "owner"    # 负责人
    TESTER = "tester"  # 测试
    VIEWER = "viewer"  # 只读


class DocFileType(str, enum.Enum):
    """需求文档文件类型"""

    MARKDOWN = "markdown"
    WORD = "word"
    PDF = "pdf"
    TEXT = "text"


class Priority(str, enum.Enum):
    """用例优先级"""

    P0 = "P0"  # 冒烟/最高
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"  # 最低


class CaseType(str, enum.Enum):
    """用例类型"""

    FUNCTIONAL = "functional"      # 功能
    INTERFACE = "interface"        # 接口
    PERFORMANCE = "performance"    # 性能
    COMPATIBILITY = "compatibility"  # 兼容


class CaseStatus(str, enum.Enum):
    """用例状态"""

    DRAFT = "draft"           # 草稿（AI 生成默认）
    REVIEWING = "reviewing"   # 评审中
    APPROVED = "approved"     # 已通过
    DEPRECATED = "deprecated" # 已废弃


class ExecutionResult(str, enum.Enum):
    """用例执行结果"""

    PASSED = "passed"     # 通过
    FAILED = "failed"     # 失败
    BLOCKED = "blocked"   # 阻塞
    SKIPPED = "skipped"   # 跳过


class MessageRole(str, enum.Enum):
    """AI 对话消息角色"""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class TaskStatus(str, enum.Enum):
    """AI 生成任务状态"""

    PENDING = "pending"    # 排队中
    RUNNING = "running"    # 生成中
    SUCCESS = "success"    # 成功
    FAILED = "failed"      # 失败
    CANCELED = "canceled"  # 已取消
