# ktv-admin

KTV 系统的 Vue 3 PC 管理基础框架，与 ktv-backend 和 ktv-app 共同组成项目。

## 项目简介

基于 RuoYi-Vue3 3.9.1 的运营管理前端，包含登录与验证码、动态路由和权限指令、用户资料、系统管理与监控页面基础代码。通过 Axios 访问 ktv-backend 的若依管理 API，使用 Pinia 管理登录状态及界面设置。

当前首页是空白工作区，数据库种子中的业务菜单为空；保留的系统管理、监控和工具组件需要相应菜单及后端能力才能使用。KTV 餐品、包厢、订单和食堂管理的现有业务界面位于 **ktv-app 第 13–22 页**，尚未移植到此 PC 后台。代码生成和定时任务服务目前未在后端构建中启用。

登录页仅支持记住账号，不保存密码，也不在前端分发 RSA 私钥。

## 技术栈

| 类别 | 实际使用 |
| --- | --- |
| 界面 | Vue 3.5.26、JavaScript、Element Plus 2.13.1、Sass |
| 构建 | Vite 6.4.1、npm |
| 路由与状态 | Vue Router 4.6.4、Pinia 3.0.4 |
| 通信与图表 | Axios 1.13.2、ECharts 5.6.0 |
| 编辑器与工具 | Quill、VueUse、SVG 图标 |

本项目源码使用 JavaScript，未将 TypeScript 作为应用开发语言。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| ktv-backend | 后端 API、共享订单与权限服务 | [ktv-backend](https://github.com/jiangyi3265/ktv-backend) |
| ktv-admin | PC 运营管理基础框架 | [ktv-admin](https://github.com/jiangyi3265/ktv-admin) |
| ktv-app | 顾客、食堂配送及 KTV 移动管理客户端 | [ktv-app](https://github.com/jiangyi3265/ktv-app) |

## 快速启动

准备 Node.js 22 或 24（当前以 24 验证）和 npm，并按 ktv-backend README 启动后端、初始化 PC 管理员密码。

```powershell
npm ci
Copy-Item .env.development.example .env.development
npm run dev
```

默认访问 `http://localhost/`（Vite 监听端口 **80**），`/dev-api` 由 Vite 转发到 `http://localhost:8080`。端口冲突时可运行 `npm run dev -- --port 5173`。更换后端地址时修改 `vite.config.js` 中的 `baseUrl`。

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
src/views/        登录、注册、资料、系统、监控及工具页面
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

基于 Vue 3、Element Plus 和 Pinia 搭建 KTV 系统 PC 管理基础框架，接入若依登录认证、动态路由与按钮权限控制。整理环境配置和 API 代理，为后续运营业务页面扩展提供统一入口。

## 来源与许可证

基于 [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3) 开发，保留原项目 MIT 许可证与作者声明，详见 [LICENSE](LICENSE)。
