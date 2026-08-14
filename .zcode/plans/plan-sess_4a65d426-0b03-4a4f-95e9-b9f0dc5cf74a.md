# 迁移方案:CLAUDE.md → AGENTS.md(让 ZCode 读取代码规范)

## 背景
ZCode 读取的工程指令文件是 **`AGENTS.md`**(从当前目录向上搜到项目根),不读 `CLAUDE.md`。现在根目录只有 `CLAUDE.md`(~99 行前后端规范),ZCode 完全看不到。需迁移到 `AGENTS.md`。

## 要做的事

### 1. 创建根 `AGENTS.md`(主要内容迁移)
基于现有 `CLAUDE.md` 内容,但做以下**清理**(因现状已与 CLAUDE.md 描述不符):
- 顶部说明从"Claude Code 指引"改为"ZCode/Agent 指引"。
- 删/改第 96-98 行「工具链上下文」整节:其中 `.mcp.json` 已删除、`.claude/` 目录已删除、`.claude/skills/` 约25个技能已不存在。改为反映**当前实际**:
  - MCP 现在在 `.zcode/config.json`(`docs-langchain` + `reference-langchain`,workspace 级 HTTP)。
  - 项目级 skills 现在在 `.zcode/skills/`(23 个,已安装:frontend-design / 15 stitch / 7 ui-ux-pro-max)。
- 第 15 行关于前端的那句改为指向 `frontend/AGENTS.md`(现状)。
- 第 81 行的 `frontend/AGENTS.md` 警告保留(现状正确)。
- 其余章节(仓库结构、后端运行/规范/数据库/架构/RBAC/技能、前端技术栈、设计系统)**内容仍有效**,整体保留,仅做上述过时处的修正。

### 2. 删除根 `CLAUDE.md`
迁移完成后删除。它含的过时引用(`.mcp.json`、`.claude/`)留着会误导。ZCode 也不读它。

### 3. 删除 `frontend/CLAUDE.md`
该文件只有一行 `@AGENTS.md` -- 这是 **Claude Code 的导入语法**,ZCode 不解析。真正的 Next.js 警告内容在 `frontend/AGENTS.md`(保留不动)。删除这个单行文件即可,`frontend/AGENTS.md` 留着继续生效。

## 不会改的
- `frontend/AGENTS.md` -- 保留原样(内容正确,ZCode 在 `frontend/` 下会读)。
- `backend/`、`frontend/` 下的任何代码文件。
- `.zcode/` 下刚装好的 skills 和 config。
- 不动 `.gitignore`。

## 验证
- 确认根 `AGENTS.md` 存在且 ZCode 能读到(文件名正确、在仓库根)。
- 确认 `CLAUDE.md` 与 `frontend/CLAUDE.md` 已删除。
- 确认 `frontend/AGENTS.md` 内容未变。