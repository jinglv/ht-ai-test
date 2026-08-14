# SITE.md — 河图智弈 · 企业级 AI 智能体测试平台

> 循河图数理，以智弈控测

## 1. 站点愿景

企业级 AI 驱动的测试管理平台原型。实现「自然语言提问 → 自然语言信息分析 → 智能可视化展示」一站式对话式测试体验，覆盖 RBAC 权限、测试项目管理、AI 用例生成与对话式分析。

## 2. Stitch 项目信息

- **Project ID:** `15844466494168311713`
- **设计系统资产:** `assets/5712420502560617273`
- **设备类型:** DESKTOP
- **语言:** 简体中文

## 3. 设计系统

见 `.stitch/DESIGN.md`（明亮极简科技风 + 轻量化新中式）。主色科技青蓝 #2A76C9，背景雅白 #F8FAFD，深色骨架黛青 #23344D，国风点缀鎏金 #D4B86A。

## 4. 站点地图 (Sitemap)

### 统一后台框架（所有登录后页面共用）

- 顶部黛青 (#23344D) 通栏导航：左侧圆形 LOGO（`logo.png` 位图 + 鎏金描边）+ 白色思源宋体「河图智弈」；右侧线性白色图标（消息/设置/退出）+ 圆形头像「管理员 · 系统总调度」。
- 左侧 220px 黛青侧边栏（支持折叠），一级菜单：**首页、项目管理、用例管理、AI对话分析、系统管理**（展开子项：用户管理、角色管理、权限管理）。选中态：左侧 3px 鎏金竖线 + 半透科技青蓝底 + 白色加粗。

### 页面清单 (Sitemap)

- [x] **login** — 登录页（左 56% 沉浸式品牌区 + 右 44% 玻璃拟态登录卡片）· screen `a1bbcfd7d8004e8a9010597eb8a16c95`
- [x] **home** — 首页工作台（统计卡 + 快捷入口 + 最近项目 + 待办事项）· 本地 `designs/home.html`
- [x] **projects** — 项目管理（项目列表 + 模块树 + 成员）· screen `ed2c848dcfe649fb8f0af92a7470a535`
- [x] **testcases** — 用例管理（模块树 + 用例表格 + AI 生成入口）· screen `f4732034c74d4fb39a064de4b2414709`
- [x] **ai-chat** — AI 对话分析（会话列表 + 消息流 + 智能图表）· screen `fcc98d7917474d15a19dada0dc7bcfbe`
- [x] **dashboard-users** — 用户管理（RBAC 表格）· screen `aac4f8a2b5b842f1b94e052eb14c28f0`
- [x] **roles** — 角色管理（角色表格 + 数据权限标签 + 权限树授权弹窗）· screen `16f0f48963474dafa857236509e69eb4`
- [x] **permissions** — 权限管理（权限点树形结构：菜单/操作/数据三类 + 权限编码 + 详情卡）· screen `3ce04e7af0554f9b977acb3dc4cef05a`
- [x] **test-suites** — 测试套件（套件列表表格 + 套件用例排序卡 + 拖拽排序）· screen `2b35102be3494242824cadadc2c0c8a4`
- [x] **requirements** — 需求文档（文档列表 + 文件类型标签 + AI 需求智能分析：功能点/边界/场景提炼）· screen `ff0e5b145a6f4ac0b4750e7e420a9a6b`
- [x] **execution-records** — 执行记录（4 统计卡 + 执行记录表格 + 通过率环形图/趋势柱状图）· screen `e00cd47b013246688fa78b3d35daf1a4`
- [x] **profile** — 个人中心（个人资料卡 + 基本信息表单 + 角色标签）· screen `6d2a6099f57c466db1322e9562f52d11`
- LOGO 图 · screen `69912dd3005f4d26acc17701959490fb`

> 本地资产（HTML + PNG）已下载至 `.stitch/designs/`。所有页面的品牌 LOGO 已统一改用真实位图 `logo.png`（相对路径 `../../logo.png`），不再使用早期的内联 SVG 占位图。login.html 已重做为沉浸式高端版（旋转鎏金光环、玻璃卡片、错位入场动画），比对应的 login.png 快照更新。ai-chat.png 缩略图渲染异常（Google CDN 对纯 CSS conic-gradient 图表的已知问题），但 ai-chat.html 内容完整、可正常本地打开查看。
>
> **新页面框架对齐（2026-07-06）**：roles / permissions / test-suites / requirements / execution-records / profile 六页的 Stitch 原生 HTML（Tailwind CDN、占位图标 LOGO、错误侧栏菜单、无导航）已在本地**整体重写**，改用与 dashboard-users 等原页面一致的 shell（自写 CSS 类系统、本地 logo.png、深海蓝渐变顶栏/侧栏、思源宋体+Inter、`toggleSidebar` 折叠交互、鎏金标题竖线/Tab 角标）。同时回填了原页面的导航链接：全站侧栏「角色管理/权限管理」→ roles.html/permissions.html；testcases 4 Tab 互通（用例列表/测试套件/需求文档/执行记录）。**注意：这 6 页的本地 HTML 已与 Stitch 画布上的对应屏幕内容不一致（本地版为最新），如需在 Stitch 端同步需重新上传或重生成。**

## 5. 路线图 (Roadmap / 待办)

> 角色管理页已完成（见上 sitemap）。本轮新增范围：用例管理 3 个子 Tab 独立屏 + 个人中心 + 项目概览。

- [x] 角色管理页（角色表格 + 权限树弹窗授权）· screen `16f0f48963474dafa857236509e69eb4`
- [x] 权限管理页（权限点树形结构：菜单权限/操作权限/数据权限）· screen `3ce04e7af0554f9b977acb3dc4cef05a`
- [x] 测试套件管理页（用例管理 > 测试套件 Tab）· screen `2b35102be3494242824cadadc2c0c8a4`
- [x] 需求文档管理页（用例管理 > 需求文档 Tab）· screen `ff0e5b145a6f4ac0b4750e7e420a9a6b`
- [x] 用例执行记录页（用例管理 > 执行记录 Tab）· screen `e00cd47b013246688fa78b3d35daf1a4`
- [x] 个人中心页（个人信息 / 修改密码 / 我的角色）· screen `6d2a6099f57c466db1322e9562f52d11`
- [ ] 项目概览页（项目维度统计大屏 + 可视化图表）· **待 Stitch 生成端点恢复**（baton 已备好见 `.stitch/next-prompt.md`，生成端点持续 fetch failed，读取正常）

## 6. 创意自由区 (Creative Freedom)

- 深色适配模式演示
- 移动端单列布局适配
- 智能体拓扑链路图可视化大屏
