# ktv-admin

KTV 系统的 PC 运营管理后台，与 ktv-backend 和 ktv-app 共享餐品、订单、包厢和食堂数据。

## 项目简介

基于 RuoYi-Vue3 3.9.1 的运营管理前端，包含登录与验证码、动态路由和权限指令、用户资料、系统管理与监控页面基础代码。通过 Axios 访问 ktv-backend 的若依管理 API，使用 Pinia 管理登录状态及界面设置。

首页提供 KTV 运营工作台，支持历史订单搜索与分页、取消、转派、全额退款，餐品与图片维护、包厢二维码、食堂账号权限、支付配置状态及审计日志。顾客与食堂在 ktv-app 操作后，本后台同步读取同一后端数据库。若依代码生成及通用任务管理未启用；KTV 超时关单、支付和退款核对由后端独立定时任务运行。

登录页仅支持记住账号，不保存密码，也不在前端分发 RSA 私钥。

## 技术栈

| 类别 | 实际使用 |
| --- | --- |
| 界面 | Vue 3.5.44、JavaScript、Element Plus 2.13.1、Sass |
| 构建 | Vite 6.4.4、npm |
| 路由与状态 | Vue Router 4.6.4、Pinia 3.0.4 |
| 通信与图表 | Axios 1.20.0、ECharts 6.1.0 |
| 编辑器与工具 | Quill、VueUse、SVG 图标 |

本项目源码使用 JavaScript，未将 TypeScript 作为应用开发语言。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| ktv-backend | 后端 API、共享订单与权限服务 | [ktv-backend](https://github.com/jiangyi3265/ktv-backend) |
| ktv-admin | PC 运营管理后台 | [ktv-admin](https://github.com/jiangyi3265/ktv-admin) |
| ktv-app | 顾客、食堂配送及 KTV 移动管理客户端 | [ktv-app](https://github.com/jiangyi3265/ktv-app) |

## 快速启动

准备 Node.js 22 或 24（当前以 24 验证）和 npm，并按 ktv-backend README 启动后端、初始化 PC 管理员密码。

```powershell
npm ci
Copy-Item .env.development.example .env.development
npm run dev
```

默认访问 `http://localhost/`（Vite 监听端口 **80**），`/dev-api` 由 Vite 转发到 `http://localhost:8080`。端口冲突时可运行 `npm run dev -- --port 5186 --strictPort`。更换后端地址时修改 `vite.config.js` 中的 `baseUrl`。

使用后端初始化的 PC 账号 `admin` 和自行设置的密码登录。移动端账号 `ktv-admin` / 食堂账号 `A01` 不属于若依 PC 登录体系。

构建生产或预发布包：

```powershell
Copy-Item .env.production.example .env.production
npm run build:prod
# 预发布配置（按需）
Copy-Item .env.staging.example .env.staging
npm run build:stage
```

输出目录为 `dist/`。生产 `/prod-api`、预发布 `/stage-api` 需要在部署服务器配置反向代理到后端并移除该路径前缀；Vite 开发代理不会包含在静态构建中。`npm run preview` 可用于检查构建页面，业务接口仍需有效代理。

`.env.*.example` 仅包含公开的标题和 API 路径，实际 `.env` 配置均已忽略。任何 `VITE_*` 值都会进入浏览器代码，不能放置数据库密码、私钥或服务端 Token。

## 项目结构

```text
src/api/          若依系统、监控和登录 API 封装
src/views/        KTV 运营工作台、登录、资料、系统、监控等页面
src/router/       静态路由与动态页面入口
src/store/        Pinia 用户、权限和界面状态
src/layout/       导航栏、菜单、标签页及布局框架
src/components/   上传、表格、分页、编辑器等复用组件
src/directive/    权限与通用交互指令
src/utils/        HTTP 请求、认证、校验和辅助方法
vite/             构建插件配置
public/           原样发布的公共资源
```

## 验证

`npm run build:prod` 验证生产构建。当前 `package.json` 没有单元测试脚本，不提供不存在的 `npm test` 命令。

## 简历描述示例

基于 Vue 3、Element Plus 和 Pinia 实现 KTV 运营后台，完成订单处理、餐品图片、包厢二维码、食堂权限与操作审计。通过若依 JWT 权限体系接入统一 API，实现顾客、食堂及管理端业务数据同步。

## 来源与许可证

基于 [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3) 开发，保留原项目 MIT 许可证与作者声明，详见 [LICENSE](LICENSE)。

## KTV 运营工作台

登录后首页为 KTV 运营工作台：订单分页、取消未付款订单、转派食堂、管理员全额退款、餐品图片/售价/上下架、包厢启停、网页码/小程序码下载、食堂账号与权限、支付配置状态和操作日志。使用现有 PC JWT 身份访问统一 `/ktv-api`，仅超级管理员或具有 `ktv:manage` 权限的账号可操作，无需在浏览器另存移动管理员密码。顾客和食堂使用 ktv-app，与本后台共享同一数据库。

运行 `npm run dev -- --port 5186 --strictPort` 可在本机5186端口联调；使用独立后端时设置 `KTV_BACKEND_ORIGIN`。开发代理 `/dev-api`、生产代理 `/prod-api` 均转发到后端根路径。部署到 `/admin/` 时设置 `VITE_APP_BASE_PATH=/admin/`。后端默认CORS包含本地5186端口，生产域名通过 `KTV_ALLOWED_ORIGINS` 显式配置。

2026-11-09 已通过隔离环境的登录、餐品图片、二维码、日志及三端同步验收；线上真实支付与退款到账仍需手机确认。已更新 `follow-redirects`；继承的代码生成工具依赖链仍有安全告警，详见后端仓库的 [三端验收报告](https://github.com/jiangyi3265/ktv-backend/blob/main/deploy/2026-11-09-三端验收报告.md)。

## 收支总账

电脑后台首页增加“收支总账”：按日期、收款/退款、完整订单号/包厢/微信单号筛选，查看全范围合计、每页 50 条明细和按日汇总，导出 CSV。仅统计真实成功收款及退款；未付款、演示订单不计入，净收款不等同于利润或可提现余额。权限和统计均由 ktv-backend 校验。

2026-11-10 已完成隔离数据库下的账单、筛选、汇总、导出验收并部署至线上 `/admin/`。数据口径、权限及发布记录见 [收支账单验收](https://github.com/jiangyi3265/ktv-backend/blob/main/deploy/2026-11-10-收支账单验收.md)。
