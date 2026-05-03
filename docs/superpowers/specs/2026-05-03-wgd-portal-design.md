# WGD Portal — 公司门户网站设计文档

## 概述

公司内部员工门户网站，集中管理公司各类外部 Web 应用（SaaS、自建工具等）的访问入口。部署于 Netlify，适配手机端。

## 技术选型

- **框架**: Next.js (Static Export)
- **样式**: Tailwind CSS
- **动效**: Framer Motion
- **部署**: Netlify（纯静态输出）
- **数据**: 项目内 JSON 文件，无需数据库
- **鉴权**: 客户端鉴权（固定账号密码，SHA-256 哈希比对，sessionStorage 存储登录态）

## 风格定义

- **主题**: 深色科技风，参考 Glass Login Card 设计
- **配色**: 背景 `#0a0e1a`，主色渐变 青色(`#00d4ff`) → 紫色(`#7c3aed`)
- **核心样式**: 毛玻璃效果 (`backdrop-filter: blur`)，半透明卡片，霓虹发光边框
- **装饰**: 浮动光晕背景，渐变强调元素

## 页面结构

### 1. `/login` — 登录页

- 深色渐变背景 + 浮动光晕装饰
- 毛玻璃效果登录卡片（居中）
- 公司 Logo + 名称
- 账号/密码输入框（聚焦发光描边）
- 渐变登录按钮（hover 流光效果）
- 错误状态：卡片抖动动画
- 成功登录：跳转至首页
- 已登录用户：自动跳转首页

### 2. `/` — 首页（工作台）

- 顶部毛玻璃导航栏：Logo + 用户欢迎语 + 头像 + 退出按钮
- Hero 区：公司名称 + "工作台"标题
- 搜索栏：实时搜索过滤应用
- 分类标签：横向滚动，全部/各分类
- 应用卡片网格：
  - Desktop: 3 列
  - Tablet: 2 列
  - Mobile: 2 列
  - 每张卡片：图标 + 名称 + 描述，点击在新标签页打开
  - 悬停效果：上浮 + 光晕
  - 入场动画：交错淡入上升

### 3. `/admin` — 管理后台

- 管理员导航侧栏（移动端折叠）
- 概览统计：用户数、应用数
- 快捷操作入口

### 4. `/admin/users` — 用户管理

- 用户表格/卡片列表
- 添加用户（弹窗/表单）
- 编辑用户（弹窗/表单）
- 删除用户（确认弹窗）
- 字段：用户名、显示名称、角色（admin/user）、创建时间

### 5. `/admin/apps` — 应用管理

- 应用表格/卡片列表
- 添加应用（弹窗/表单）
- 编辑应用（弹窗/表单）
- 删除应用（确认弹窗）
- 拖拽排序
- 字段：名称、URL、图标（预设 SVG/Emoji）、分类、描述、排序

## 数据模型

### users.json
```json
[
  {
    "id": "u1",
    "username": "admin",
    "password": "hashed_value",
    "name": "管理员",
    "role": "admin",
    "createdAt": "2026-05-03"
  }
]
```

### apps.json
```json
[
  {
    "id": "a1",
    "name": "GitHub",
    "url": "https://github.com",
    "icon": "github",
    "category": "开发工具",
    "description": "代码托管平台",
    "order": 1
  }
]
```

### config.json
```json
{
  "siteName": "WGD Portal",
  "categories": ["开发工具", "数据分析", "项目管理", "沟通协作"],
  "defaultCategory": "全部"
}
```

## 动态效果清单

1. 登录页：背景光晕缓慢浮动 (CSS keyframes)
2. 登录页：卡片加载时从下方淡入上升
3. 登录页：输入框聚焦发光描边 (CSS transition)
4. 登录页：按钮 hover 渐变流光效果
5. 登录页：错误时卡片抖动 (Framer Motion)
6. 首页：应用卡片悬停上浮 + 光晕
7. 首页：卡片列表入场交错动画 (Framer Motion stagger)
8. 首页：分类标签切换平滑过渡
9. 首页：搜索实时过滤效果
10. 全局：页面切换过渡动画

## 路由守卫

- 未登录用户访问 `/` 或 `/admin/*` → 重定向到 `/login`
- 非管理员访问 `/admin/*` → 重定向到 `/`
- 登录页检测到已登录状态 → 自动跳转 `/`

## 部署

- `next build && next export` 输出静态文件到 `out/` 目录
- Netlify 直接部署 `out/` 目录
- 无需服务器端运行时

## 未来扩展考虑

- 集成第三方登录（Google/GitHub OAuth）
- 应用访问统计
- 自定义主题/Logo
- PWA 支持（离线访问）
