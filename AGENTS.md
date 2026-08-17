# AGENTS.md

本文件为 ZCode（及兼容 Agent Skills 规范的编码 agent）在本仓库中工作时提供指引。

## 仓库结构

**河图智弈 (Hetu)** 的 monorepo -- 一款企业级 AI 驱动的测试管理平台。顶层分三块：

- `backend/` - Python API + 智能体编排（FastAPI + Tortoise-ORM + DeepAgents）。src 布局，导入包名 `hetu`。
- `frontend/` - Next.js 16 + React 19 + Tailwind 4 + TypeScript（App Router）。
- `docs/ht-ai-test/` - 权威产品规格（PRD）、Stitch 设计原型与设计系统。

`docs/ht-ai-test/PRD-河图智弈-产品需求文档-v1.0.0.md` 是**技术栈与架构的事实来源**。其技术选型标注为硬性约束（锁定、不可更改）。当代码与 PRD 不一致时，以 PRD 为准--修正代码，而非延续偏差。

前端有自己的 `frontend/AGENTS.md`，含一条关键的 Next.js 警告--见下文「前端」一节。

## 后端（`backend/`）

### 运行 / 开发
- Python ≥3.13。用 **uv** 管理依赖与虚拟环境；用 **ruff** 做 lint。所有命令在 `backend/` 下执行。
- 导入根是 `src/` 下的 `hetu` 包（src 布局）。拉取依赖或修改 `pyproject.toml` 后，需以可编辑模式重装，导入方能解析：`uv pip install -e .`
- 预期的 ASGI 入口为 `main:app`（FastAPI + uvicorn，开启 reload）。运行：`uv run uvicorn main:app --reload`（host/port/reload 也从 `backend/.env` 读取）。

> **脚手架注意：** 后端处于早期脚手架阶段--根 `main.py` 仅有文件头与 docstring 框架（尚无 FastAPI 实现）、`src/hetu/{agents,core,modules,shared}/` 为仅有文件头的 `__init__.py`，且 `pyproject.toml` 中 `name = "backend"`、**无 `[build-system]`/包配置**。PRD 意图是包 `hetu`（可编辑安装 `src/hetu/`）。在 `uv pip install -e .` 与 Tortoise CLI 可用之前，需补上构建后端并修正包名。

### 代码规范
`backend/src/hetu/` 与 `backend/tests/` 下每个新建的 `.py` 文件（含 `__init__.py`）必须以如下 PyCharm 风格文件头起始，置于模块 docstring 与导入之前：

```python
# Project ：backend
# File    ：config.py
# Author  ：jinglv
# Date    ：2026/7/4 22:09
# Software：PyCharm
```

冒号为全角 `：`；`File` 取实际文件名（`__init__.py` 勿写成 `__init__.py.py`）；`Author` 默认 `jinglv`；`Date` 为创建日期（`YYYY/M/D H:MM` 不补零），创建后不随修改更新。其余硬性要求：

- **注释**：每个文件写模块 docstring，公开函数/类写 docstring，非显然逻辑写行内注释（解释"为什么"）。注释与日志文案统一用简体中文。
- **日志**：统一用 loguru（`from loguru import logger`）--路由层记意图/结果、service/CRUD 记关键步骤、异常用 `logger.exception(...)`；禁止 `print()` 与混用 `logging`；不得记录密码/token/连接串等敏感信息。

完整标准见 `backend-engineering-standards` 技能。

### 数据库（Tortoise-ORM，异步）
- 锁定技术栈为 **PostgreSQL + asyncpg**（`pyproject.toml`：`tortoise-orm[asyncpg]`、`psycopg-binary`）。PRD §2.3.1 使用 `postgres://` 连接串。
- **迁移用 Tortoise 内置工具，不用 Aerich**（Aerich 已列为遗留）。在 `backend/` 下执行：
  - `tortoise init` - 建迁移包
  - `tortoise makemigrations` - 自动 diff 模型变更 -> 生成迁移文件
  - `tortoise migrate` - 应用迁移
  - `tortoise sqlmigrate models 0001_initial` - 预览 SQL 而不执行
  - `generate_schemas()` 仅用于开发期建表（`CREATE TABLE IF NOT EXISTS`，不做增量 ALTER）；真实环境用迁移。
- `TORTOISE_ORM` 位于 `src/hetu/config.py`，并被 `pyproject.toml` 的 `[tool.tortoise]` 引用。`migrations` 路径相对 `backend/` 解析。**`skills/` 与 `migrations/` 是按文件系统路径加载的资源，绝不可 `import`**--它们留在 `backend/` 根，不进 `src/`。
- 配置经 `pydantic-settings`（`src/hetu/settings.py`），`case_sensitive=True`，读取 `backend/.env`。环境变量名必须与字段名精确匹配。

> **脚手架注意：** `config.py` 当前配置的是 **MySQL** 引擎（`tortoise.backends.mysql`），且 `backend/.env` 用 `PLATFORM_DB_*` 键而 `settings.py` 定义的是 `DATABASE_*` 字段。两者都与锁定的 PostgreSQL 技术栈及大小写敏感的设置相矛盾--接入数据库时需修正。

### 预期架构（PRD §2.3 -- 多数代码尚未落地）
模块化单体，单进程 + 单库（非微服务）。`src/hetu/` 下：
- `core/` - 横切关注点：`security.py`（JWT/bcrypt）、`rbac.py`（`require_permission` / `get_data_scope`）、`deps.py`（`get_current_user`、分页）、`response.py`（统一 `{code,message,data}`）、`exceptions.py` + 全局 handler、`middleware.py`。
- `modules/<域>/` - 业务域，每域自包含 router + service + schemas + models 四件套：`auth/`、`rbac/`、`project/`、`testcase/`、`ai_chat/`（SSE 入口）。
- `agents/` - 多智能体编排（Python 代码）：`base.py`、`registry.py`（按意图路由）、`orchestrator.py`、`llm.py`（共享 DeepSeek 客户端：超时/重试/计费）、`context.py`（会话 + 数据权限上下文）、`factory.py`（`create_deep_agent`、skills 路径）。
- `shared/` - 跨域共享（enums、分页）。
- 所有域 models 注册到同一个 `models` app，因此跨域外键如 `ForeignKeyField('models.Project')` 可照常使用。

**智能体与技能正交分离：** `agents/` 管编排；`skills/` 管可复用原子能力（SKILL.md）。一个技能可被多 agent 复用。加 agent = 注册进 `registry`；加技能 = 建文件夹。orchestrator 无需改动（开闭原则）。

### RBAC + 数据权限（PRD §3.1）
- 用户 ─N:M─ 角色 ─N:M─ 权限。权限类型：菜单 / 操作（`domain:action`，如 `testcase:create`）/ 数据。
- **数据权限范围**（`role.data_scope`，枚举 `SELF`/`PROJECT`/`ALL`，默认 `SELF`）绑定在角色上；用户拥有多角色时取最大范围（`ALL > PROJECT > SELF`）。超级管理员固定为 `ALL`。
- Service 层从 `get_data_scope()` 注入过滤条件：`ALL` = 不过滤，`PROJECT` = `project_id IN (当前用户所属项目集合)`，`SELF` = `creator_id`/`owner_id = 当前用户`。**AI 的 nl2sql 查询必须叠加同一过滤**，确保对话式分析不越权。业务主表统一保留 `creator_id` + `project_id` 作为过滤依据。

### 技能（`backend/skills/`）
- 遵循 [Agent Skills 规范](https://agentskills.io)。每个技能 = `skills/<name>/SKILL.md`（YAML frontmatter `name`/`description` + markdown 正文，可附 `scripts/`·`references/`·`assets/`）。`name` 必须与目录名一致且用连字符。
- **三级渐进式加载：** 启动时只把 `name`+`description` 注入 -> 任务命中才读 `SKILL.md` 全文 -> 指令引用才读附属文件。
- 按访问域分层：`skills/shared/`（全员）+ `skills/analysis/`（仅分析 agent）。`agents/factory.py` 的 `AGENT_SKILL_SOURCES = {agent: [paths]}` 是 agent↔技能关系的单一事实来源。
- 仅当技能带可执行 `scripts/` 时才需沙箱；纯指令类技能零沙箱。`nl2sql` 建议改为指示 agent 调用后端 `run_readonly_sql` 工具（叠加数据权限过滤），而非运行脚本。
- `tests/test_skills_valid.py` 断言 `name`==目录名、frontmatter 合法--改技能时保持该测试通过。

## 前端（`frontend/`）

> ⚠️ **这不是你熟悉的那个 Next.js。** `frontend/AGENTS.md` 警告：本 Next.js 版本相对训练数据有破坏性变更--API、约定、文件结构可能都不同。**写任何 Next.js 代码前，先读 `node_modules/next/dist/docs/` 中的相关指南**，并留意 deprecation 提示。

- Next.js **16.2.10**、React **19.2**、Tailwind **4**（经 `@tailwindcss/postcss`）、TypeScript 5、ESLint 9 flat config。
- App Router 位于 `src/app/`。路径别名 `@/*` -> `./src/*`。
- 开发服务器跑在 **9528 端口**（`frontend/.env` 的 `PORT=9528`）。
- 命令（在 `frontend/` 下）：`npm run dev`（开发服务器）、`npm run build`、`npm run start`、`npm run lint`（flat-config eslint）。用 `npm`（已提交 `package-lock.json`）。

## 设计系统与 Stitch 原型（`docs/ht-ai-test/`）

- `.stitch/DESIGN.md` - 设计系统（UI 的事实来源）。`.stitch/SITE.md` - 站点地图 + 屏幕 ID。`.stitch/designs/*.html` - 页面原型。`.stitch/metadata.json` - 屏幕注册表（页面清单的权威来源）。
- 视觉语言：**明亮极简科技风 + 轻量化新中式**。色彩：科技青蓝 `#2A76C9`（主色）、鎏金 `#D4B86A`（仅点缀）、黛青 `#23344D`（深色骨架：侧栏/导航/表头）、雅白 `#F8FAFD`（页面底色）。字体：思源宋体（标题/品牌）+ 思源黑体/Inter（正文）。所有界面文案统一用**简体中文**。
- 统一框架 = 顶栏导航 + 220px 侧栏 + Tab 二级页签 + 主体区。按钮/输入框 8px 圆角，卡片/弹窗 12px，柔和投影，0.2s 过渡。
- **Stitch MCP 生成接口踩坑**（经 Stitch MCP 生成屏幕时）：切勿传 `modelId`（会导致 `fetch failed`）；瞬态失败重试 1–3 次；连续密集生成约 10 次后端点会限流（读取接口仍正常、仅生成失败--需冷却）；`list_screens` 恒返回 `{}`--改用 `metadata.json` 跟踪屏幕 ID。完整说明见 `stitch-generation-quirks` 记忆。

## 工具链上下文
- MCP 服务器配置在 `.zcode/config.json`（workspace scope，会话启动自动连接）：`docs-langchain`（`https://docs.langchain.com/mcp`）与 `reference-langchain`（`https://reference.langchain.com/mcp`）。
- 项目级 Agent Skills 安装在 `.zcode/skills/`（共 23 个）：`frontend-design`、15 个 Stitch 设计/构建/工具技能、7 个 ui-ux-pro-max 设计技能。注意 Stitch 系技能需另行配置 Stitch MCP 才能完整运行。
- 指令合并顺序：用户级 `~/.zcode/AGENTS.md` 先加载，本 workspace `AGENTS.md` 后加载并可覆盖；`frontend/AGENTS.md` 仅在 `frontend/` 下工作时叠加。
