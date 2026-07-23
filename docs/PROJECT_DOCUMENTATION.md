# 游戏体力计时器 PWA — 项目技术文档

> 版本：v1.2.2 ｜ 类型：纯前端渐进式 Web 应用（PWA） ｜ 许可证：MIT
>
> 本文档从项目整体架构、模块职责、关键类与函数、依赖关系、运行方式等多个维度对仓库进行结构化审查与说明，供开发、维护与二次开发参考。

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构](#3-目录结构)
4. [主要模块职责](#4-主要模块职责)
5. [关键类与函数说明](#5-关键类与函数说明)
6. [数据模型与存储](#6-数据模型与存储)
7. [核心业务流程](#7-核心业务流程)
8. [依赖关系](#8-依赖关系)
9. [PWA 与离线策略](#9-pwa-与离线策略)
10. [项目运行方式](#10-项目运行方式)
11. [测试体系](#11-测试体系)
12. [部署方式](#12-部署方式)
13. [安全与兼容性](#13-安全与兼容性)
14. [已知限制与设计取舍](#14-已知限制与设计取舍)

---

## 1. 项目概述

**游戏体力计时器 PWA** 是一款用于追踪多个游戏体力恢复进度的渐进式 Web 应用。核心特性包括：

- **多游戏管理**：同时追踪多个游戏的体力恢复进度
- **实时倒计时**：基于时间戳计算，每秒更新体力数值与恢复倒计时
- **本地通知**：满体力通知、间隔通知（每恢复 N 点提醒一次），全程无后端依赖
- **离线可用**：Service Worker 缓存静态资源，无网络环境可查看
- **可安装**：支持 Android Chrome、iOS Safari、桌面 Chrome/Edge 安装到主屏幕/桌面
- **本地存储**：数据保存在 IndexedDB，无需账号
- **主题色自定义**：每个计时器可设置独立主题色

### 技术定位

- **纯前端方案**：零后端、零账号体系、零外部 API 依赖
- **零运行时框架**：使用原生 ES Modules，不引入 React/Vue 等
- **零运行时第三方依赖**：生产代码不依赖任何 npm 包，仅开发期使用 vitest 等

> **架构变更说明**：v1.1 曾采用 Web Push + 后端调度方案（Redis / Cron / VAPID），v1.2 起改为纯前端本地通知方案，砍掉整个后端。代价是 app 完全关闭后无法接收通知。

---

## 2. 整体架构

### 2.1 分层架构

应用采用清晰的分层结构，业务逻辑、数据访问、平台能力相互解耦：

```
┌─────────────────────────────────────────────────────────┐
│                    表现层 (Presentation)                  │
│  index.html · css/style.css · StaminaApp (渲染/事件)      │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
┌────────────▼──────────────┐ ┌──────────▼──────────────┐
│      业务逻辑层 (Domain)    │ │    平台能力层 (Platform) │
│  StaminaCalculator 体力计算 │ │  NotificationService 通知│
│  checkNotificationThreshold │ │  Service Worker (sw.js) │
└────────────┬──────────────┘ └──────────┬──────────────┘
             │                            │
┌────────────▼────────────────────────────▼──────────────┐
│                   数据访问层 (Data)                       │
│         TimerDB (IndexedDB 封装 · 纯 CRUD)               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖图

```
                    ┌──────────┐
                    │ app.js   │  应用主类，编排所有模块
                    └──┬───┬─┬─┘
            ┌──────────┘   │ └────────┐
            ▼              ▼          ▼
       ┌────────┐    ┌─────────┐  ┌────────┐
       │ db.js  │    │timer.js │  │notify.js│
       │ 数据层  │    │ 计算层   │  │ 通知层  │
       └────────┘    └─────────┘  └────────┘
                          ▲
            ┌─────────────┘
            ▼
       ┌─────────┐
       │utils.js │  XSS 防护、颜色校验、Toast
       └─────────┘
```

### 2.3 运行时拓扑

```
浏览器 ──HTTP──> server.mjs (Node 零依赖静态服务器)
   │
   ├── 加载 index.html
   │     └── <script type="module" src="/js/app.js">
   │
   ├── 注册 sw.js (Service Worker)
   │     ├── 缓存静态资源
   │     └── 拦截 fetch 请求（网络优先 / 缓存优先）
   │
   └── IndexedDB (StaminaTimerDB)
         └── timers 表（持久化计时器数据）
```

---

## 3. 目录结构

```
stamina-timer-pwa/
├── index.html              # 应用入口 HTML
├── manifest.json           # PWA 安装清单
├── sw.js                   # Service Worker（缓存 + 通知点击）
├── server.mjs              # 零依赖静态文件服务器（Node 内置模块）
├── start.ps1               # Windows 便捷启动脚本（可选）
├── package.json            # npm 元信息（仅 devDependencies）
├── package-lock.json
├── vitest.config.js        # 测试配置
├── wrangler.jsonc          # Cloudflare Pages 部署配置
├── 游戏体力计时器.md         # 原始方案设计文档
├── .gitignore
├── .assetsignore
├── css/
│   └── style.css           # 全局样式（CSS 变量 + 响应式）
├── js/
│   ├── app.js              # 应用主类 StaminaApp + 通知阈值检测
│   ├── db.js               # IndexedDB 封装 TimerDB
│   ├── timer.js            # 体力计算器 StaminaCalculator
│   ├── notify.js           # 通知服务 NotificationService
│   └── utils.js            # 工具函数（escapeHtml / validateColor / showToast）
├── icons/
│   ├── icon-192.png        # PWA 图标 192×192
│   ├── icon-512.png        # PWA 图标 512×512
│   └── icon-maskable-512.png  # 可遮罩图标（maskable）
├── scripts/
│   └── generate-icons.js   # 纯 JS PNG 图标生成脚本
├── tests/
│   ├── setup.js            # 测试环境初始化（fake-indexeddb / crypto polyfill）
│   ├── app.test.js         # 应用逻辑测试（通知阈值检测）
│   ├── db.test.js          # 数据库测试
│   ├── notify.test.js      # 通知服务测试
│   ├── timer.test.js       # 体力计算测试
│   ├── utils.test.js       # 工具函数测试
│   └── screenshots/        # 测试截图
├── docs/
│   └── superpowers/plans/  # 历史规划文档
└── stamina-timer-guide/
    └── stamina-timer-guide.html  # 使用说明可视化页面
```

---

## 4. 主要模块职责

| 模块 | 文件 | 职责 | 依赖 |
|------|------|------|------|
| **应用主类** | `js/app.js` | 编排所有模块：CRUD、渲染、事件绑定、更新循环、PWA 安装、通知阈值轮询 | db / timer / notify / utils |
| **数据访问** | `js/db.js` | IndexedDB 的纯 CRUD 封装，分配 id/createdAt/updatedAt，无业务逻辑 | 无 |
| **体力计算** | `js/timer.js` | 基于时间戳的体力恢复计算（精确值 / 显示值 / 倒计时） | 无 |
| **通知服务** | `js/notify.js` | Notification API 封装，权限检测、iOS/standalone 检测、SW 通知 | 无 |
| **工具函数** | `js/utils.js` | XSS 转义、颜色格式校验、Toast 通知 | 无 |
| **Service Worker** | `sw.js` | 静态资源缓存、请求拦截策略、通知点击处理 | 无 |
| **静态服务器** | `server.mjs` | 零依赖本地开发服务器，仅用 Node 内置模块 | node:http/fs/path |
| **图标生成** | `scripts/generate-icons.js` | 纯 JS 生成 PNG 图标，不依赖 canvas 原生模块 | node:fs/zlib |
| **测试入口** | `tests/setup.js` | 注入 fake-indexeddb 与 crypto.randomUUID polyfill | fake-indexeddb |

---

## 5. 关键类与函数说明

### 5.1 `StaminaApp`（[js/app.js](file:///workspace/js/app.js)）

应用主类，负责整个生命周期管理。

| 成员 | 类型 | 说明 |
|------|------|------|
| `constructor()` | 方法 | 初始化 `timers` 数组并调用 `init()` |
| `async init()` | 方法 | 注册 SW、加载数据、初始化 lastNotifiedStamina、渲染、启动更新循环、绑定事件、设置通知按钮状态、设置 PWA 安装提示 |
| `bindEvents()` | 方法 | 绑定新建/通知/取消按钮、模态框遮罩点击、Escape 键、表单提交（含输入校验） |
| `startUpdateLoop()` | 方法 | 启动 `setInterval` 每秒更新；监听 `visibilitychange` 切回前台立即刷新 |
| `updateDisplay()` | 方法 | 每秒执行：更新 UI（体力数值/倒计时/进度条/is-full 状态）+ 轮询通知阈值 |
| `async addTimer(formData)` | 方法 | 组装 timer 对象（含 startTime/lastNotifiedStamina）并写入 DB |
| `async editTimer(id)` | 方法 | 打开编辑模态框，预填表单（当前体力用精确值四舍五入） |
| `async updateTimer(id, formData)` | 方法 | 重置 startTime 为当前时间，更新所有字段，刷新内存与 UI |
| `async deleteTimer(id)` | 方法 | confirm 后删除，更新内存列表与 UI |
| `async enableNotifications()` | 方法 | 请求通知权限，更新按钮状态与 Toast 反馈 |
| `setupInstallPrompt()` | 方法 | 捕获 `beforeinstallprompt` 显示安装按钮；iOS 显示添加到主屏幕引导浮层 |
| `showAddModal()` / `showEditModal(timer)` | 方法 | 打开模态框，处理焦点记忆 |
| `closeModal()` | 方法 | 关闭模态框并恢复焦点 |
| `render()` | 方法 | 重新渲染所有计时器卡片，绑定编辑/删除按钮 |

#### `checkNotificationThreshold(timer, current)`（导出函数）

[app.js#L12-L45](file:///workspace/js/app.js#L12-L45) — 体力阈值跨越检测核心，被 `updateDisplay` 每秒调用。

**职责**：
- 检测体力是否跨过"满体力"阈值（`notifyAtFull`）
- 检测体力是否跨过"间隔通知"阈值（`notifyInterval` 的整数倍）
- 使用 `lastNotifiedStamina` 防止重复弹窗
- 跨越时同步更新内存追踪值，异步持久化到 DB，已授权时发送通知

**阈值计算逻辑**：
```javascript
const highestCrossed = Math.floor(current / timer.notifyInterval) * timer.notifyInterval;
// 取最近跨越的阈值，避免 app 关闭后通知内容与实际体力不符
```

### 5.2 `StaminaCalculator`（[js/timer.js](file:///workspace/js/timer.js)）

纯函数体力计算器，所有方法为静态方法，无副作用。

| 方法 | 说明 |
|------|------|
| `static getExactStamina(timer)` | 计算精确体力值（含小数），`currentStamina + (now - startTime) / recoveryMinutes / 60000`，封顶 `maxStamina` |
| `static getCurrentStamina(timer)` | 截断整数体力，用于 UI 显示 |
| `static timeToFull(timer)` | 距离满体力的毫秒数，使用精确值保证倒计时平滑递减 |
| `static timeToNextNotify(timer)` | 距离下一次间隔通知的毫秒数，无间隔通知返回 `null` |
| `static getNextNotifyStamina(timer)` | 下一次通知的目标体力值 |
| `static formatDuration(ms)` | 格式化为"X小时Y分"或"Y分钟"，0 或负数返回"已满" |
| `static formatCountdown(ms)` | 格式化为 `HH:MM:SS`，向上取整秒 |

### 5.3 `TimerDB`（[js/db.js](file:///workspace/js/db.js)）

IndexedDB 封装，纯 CRUD，业务字段由 app.js 组装后传入。

| 方法 | 说明 |
|------|------|
| `static async getAllTimers()` | 通过 `createdAt` 索引获取所有计时器，按创建时间稳定排序 |
| `static async getTimer(id)` | 按 id 获取单个计时器 |
| `static async addTimer(timer)` | 分配 `crypto.randomUUID()` / `createdAt` / `updatedAt` 后写入 |
| `static async updateTimer(id, changes)` | 合并 `changes` 到原数据，更新 `updatedAt`，不存在则 reject |
| `static async deleteTimer(id)` | 按 id 删除 |

**数据库名**：`StaminaTimerDB`，**版本**：2，**对象仓库**：`timers`（keyPath: `id`，索引：`createdAt` / `name`）。v2 升级时移除了 v1 的 `pushSubscriptions` 表。

### 5.4 `NotificationService`（[js/notify.js](file:///workspace/js/notify.js)）

本地通知服务，零后端依赖。

| 方法 | 说明 |
|------|------|
| `static isSupported()` | 检测 `Notification` API 是否存在 |
| `static isPermitted()` | 已授权返回 true |
| `static isIOS()` | 检测 iOS/iPadOS userAgent |
| `static isStandalone()` | 检测 standalone 显示模式（已添加到主屏幕） |
| `static async requestPermission()` | 请求权限，含 iOS standalone 前置检测；返回 `{granted, reason}` |
| `static async notify(timer, type, targetStamina)` | 发送通知，优先 Service Worker 通知（后台标签页也能显示），降级为普通 Notification |

**通知标签**：`stamina-{timerId}-{type}-{targetStamina}`，`requireInteraction: true` 让通知常驻直到用户操作。

### 5.5 工具函数（[js/utils.js](file:///workspace/js/utils.js)）

| 函数 | 说明 |
|------|------|
| `escapeHtml(str)` | 通过 `textContent → innerHTML` 实现 XSS 转义，非字符串自动转字符串 |
| `validateColor(color)` | 校验 `#RRGGBB` 格式，非法返回默认色 `#4a90d9` |
| `showToast(message, type, duration)` | 非阻塞 Toast 通知，最多同时显示 3 条，支持 info/error/success 三种类型 |

### 5.6 Service Worker（[sw.js](file:///workspace/sw.js)）

| 事件 | 策略 |
|------|------|
| `install` | 预缓存 `STATIC_ASSETS`，调用 `skipWaiting()` |
| `activate` | 清理旧版本缓存，调用 `clients.claim()` |
| `fetch` (navigate) | **网络优先**，失败降级缓存（HTML 页面） |
| `fetch` (其他) | **缓存优先**，未命中再请求网络并回填缓存 |
| `notificationclick` | 关闭通知，聚焦已有窗口或打开新窗口 |

**缓存名**：`stamina-timer-v2.2`。

### 5.7 静态服务器（[server.mjs](file:///workspace/server.mjs)）

零依赖静态文件服务器，仅用 Node 内置模块。

- MIME 类型映射表覆盖 html/js/mjs/css/json/图片/字体/manifest
- **路径遍历防护**：检查 `filePath.startsWith(ROOT)`
- `Cache-Control: no-cache` 便于开发期即时刷新
- 监听 `127.0.0.1:PORT`，端口通过 `process.env.PORT` 配置（默认 3000）

### 5.8 图标生成脚本（[scripts/generate-icons.js](file:///workspace/scripts/generate-icons.js)）

纯 JavaScript PNG 生成器，不依赖 canvas 原生模块。

- 手工构建 PNG 字节流（签名 / IHDR / IDAT / IEND chunk）
- 使用 `node:zlib.deflateSync` 压缩像素数据
- 自实现 CRC32（IEEE 802.3）
- 绘制时钟图标：背景 `#1a1a2e`、外圆轮廓 `#4a90d9`、指针 `#e0e0e0`
- maskable 模式预留 10% 安全区 padding
- 生成 3 个图标：`icon-192.png` / `icon-512.png` / `icon-maskable-512.png`

---

## 6. 数据模型与存储

### 6.1 Timer 对象结构

```typescript
interface Timer {
  id: string;                  // crypto.randomUUID()，DB 分配
  name: string;                // 游戏名称
  maxStamina: number;          // 体力上限
  currentStamina: number;      // 创建/编辑时的体力基准值
  recoveryMinutes: number;     // 每点体力恢复所需分钟数
  startTime: number;           // 体力基准时间戳（创建/编辑时为 Date.now()）
  notifyAtFull: boolean;       // 是否在满体力时通知
  notifyInterval: number;      // 间隔通知阈值（0 = 不通知）
  lastNotifiedStamina: number; // 上次通知时的体力值，防止重复弹窗
  color: string;               // 主题色 #RRGGBB
  createdAt: number;           // DB 分配
  updatedAt: number;           // DB 分配/更新
}
```

### 6.2 存储设计要点

- **无后端**：所有数据存于浏览器 IndexedDB，跨设备不同步
- **时间戳驱动**：体力值通过 `currentStamina + (now - startTime)` 计算，无需后台常驻
- **版本迁移**：v1→v2 移除 `pushSubscriptions` 表（不再需要 Web Push）
- **兼容旧数据**：app 启动时为缺少 `lastNotifiedStamina` 的旧记录补默认值并持久化

---

## 7. 核心业务流程

### 7.1 应用启动流程

```
new StaminaApp()
  └── init()
       ├── 注册 Service Worker (sw.js)
       ├── TimerDB.getAllTimers() 加载所有计时器
       ├── 兼容性修复：为旧数据补 lastNotifiedStamina
       ├── render() 首次渲染
       ├── startUpdateLoop() 启动每秒更新 + visibilitychange 监听
       ├── bindEvents() 绑定所有 DOM 事件
       ├── 恢复通知按钮状态（已授权则禁用按钮）
       └── setupInstallPrompt() 配置 PWA 安装提示
```

### 7.2 每秒更新流程

```
setInterval(updateDisplay, 1000)
  └── for each timer:
       ├── StaminaCalculator.getCurrentStamina(timer)  → current
       ├── StaminaCalculator.timeToFull(timer)         → toFull
       ├── StaminaCalculator.formatCountdown(toFull)   → countdown
       ├── 更新 DOM：current-stamina / countdown / progress-fill / is-full
       └── checkNotificationThreshold(timer, current)
            ├── current <= lastNotified? → 跳过
            ├── 满体力跨越? → notifyType='full'
            ├── 间隔阈值跨越? → notifyType='interval'
            └── 若触发：
                 ├── 同步更新 timer.lastNotifiedStamina
                 ├── 异步 TimerDB.updateTimer 持久化
                 └── 已授权? → NotificationService.notify()
```

### 7.3 创建/编辑计时器流程

```
表单 submit
  ├── 输入校验（名称/上限/当前/间隔/数值范围）
  ├── mode === 'edit'?
  │     └── updateTimer: 重置 startTime=now, lastNotifiedStamina=currentStamina
  └── mode === 'add'?
        └── addTimer: 组装完整对象 → TimerDB.addTimer → push 到 timers → render
```

### 7.4 通知触发流程

```
体力每秒变化
  └── checkNotificationThreshold 检测跨越
       ├── 满体力：current >= maxStamina && lastNotified < maxStamina
       └── 间隔：highestCrossed = floor(current/interval)*interval
                  highestCrossed > lastNotified && < maxStamina
            └── NotificationService.notify
                 ├── navigator.serviceWorker.ready.showNotification (优先)
                 └── new Notification (降级)
```

---

## 8. 依赖关系

### 8.1 运行时依赖

**零运行时依赖**。生产代码不引入任何 npm 包，全部基于浏览器原生 API：

| 浏览器 API | 用途 |
|-----------|------|
| IndexedDB | 本地数据持久化 |
| Service Worker | 离线缓存 + 通知显示 |
| Notifications API | 系统通知 |
| Web App Manifest | PWA 安装 |
| `crypto.randomUUID` | 生成计时器 id |
| `setInterval` / `visibilitychange` | 更新循环 |
| `beforeinstallprompt` / `appinstalled` | PWA 安装提示 |

### 8.2 开发期依赖（devDependencies）

来自 [package.json](file:///workspace/package.json)：

| 包 | 版本 | 用途 |
|----|------|------|
| `vitest` | ^2.0.0 | 单元测试框架 |
| `fake-indexeddb` | ^6.0.0 | Node 环境模拟 IndexedDB |
| `jsdom` | ^25.0.0 | Node 环境模拟 DOM |
| `canvas` | ^2.11.2 | （备用）canvas 支持 |

### 8.3 模块间依赖关系

```
app.js ──依赖──> db.js
       ──依赖──> timer.js
       ──依赖──> notify.js
       ──依赖──> utils.js

timer.js  ──无依赖──> (纯计算)
db.js     ──无依赖──> (纯 IndexedDB 封装)
notify.js ──无依赖──> (纯 Notification 封装)
utils.js  ──无依赖──> (纯工具函数)
```

底层四个模块完全独立、可单独测试，app.js 作为编排层组合它们。

---

## 9. PWA 与离线策略

### 9.1 PWA 清单（[manifest.json](file:///workspace/manifest.json)）

| 字段 | 值 |
|------|----|
| `name` | 游戏体力计时器 |
| `short_name` | 体力计时 |
| `start_url` | `/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `background_color` / `theme_color` | `#1a1a2e` |
| `icons` | 192 / 512 / maskable-512 |

### 9.2 Service Worker 缓存策略

| 请求类型 | 策略 | 说明 |
|---------|------|------|
| 导航请求 (HTML) | 网络优先，降级缓存 | 在线时获取最新，离线时返回缓存的 index.html |
| 静态资源 (JS/CSS/图标) | 缓存优先，降级网络 | 首次加载后缓存，后续离线可用 |
| 安装时 | 预缓存 `STATIC_ASSETS` | 列出全部核心资源 |
| 激活时 | 清理旧版本缓存 | 仅保留 `stamina-timer-v2.2` |

### 9.3 安装支持

- **桌面 Chrome/Edge**：捕获 `beforeinstallprompt`，显示自定义"安装应用"按钮
- **iOS Safari**：检测非 standalone 模式，显示"添加到主屏幕"引导浮层（sessionStorage 记忆关闭状态）

---

## 10. 项目运行方式

### 10.1 环境要求

- **Node.js 18+**（开发服务器使用原生 ES Modules 与 `node:*` 内置模块）
- 现代浏览器（支持 ES Modules / IndexedDB / Service Worker / Notifications）

### 10.2 本地开发

```bash
# 方式一：npm 脚本（推荐）
npm start
# 等价于 node server.mjs

# 方式二：直接运行
node server.mjs

# 方式三：Windows 一键启动（自动探测端口 + 打开浏览器）
./start.ps1
```

启动后访问 `http://127.0.0.1:3000/`。

**端口配置**：
- 默认 `3000`，可通过环境变量 `PORT` 覆盖：`PORT=3001 node server.mjs`
- `start.ps1` 自动探测 3000→3001→3002 中的可用端口

**停止**：`Ctrl+C`

### 10.3 npm 脚本一览

| 命令 | 作用 |
|------|------|
| `npm start` / `npm run serve` | 启动本地开发服务器 |
| `npm test` | 运行全部单元测试（`vitest run`） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run generate-icons` | 重新生成 PWA 图标 |

### 10.4 无需 npm install 的运行

由于生产代码零依赖，且 `server.mjs` 仅用 Node 内置模块，**可跳过 `npm install` 直接 `node server.mjs`** 启动。`npm install` 仅在需要运行测试或重新生成图标时必要。

---

## 11. 测试体系

### 11.1 配置（[vitest.config.js](file:///workspace/vitest.config.js)）

- 测试框架：**Vitest**
- 环境：**jsdom**
- 全局 globals：开启
- setup 文件：`tests/setup.js`（注入 fake-indexeddb + crypto polyfill）
- 测试文件：`tests/**/*.test.js`

### 11.2 测试覆盖

| 测试文件 | 覆盖模块 | 重点用例 |
|---------|---------|---------|
| [tests/app.test.js](file:///workspace/tests/app.test.js) | `checkNotificationThreshold` | 满体力通知、间隔通知、阈值精确跨越、防重复、未授权不发送 |
| [tests/timer.test.js](file:///workspace/tests/timer.test.js) | `StaminaCalculator` | 精确体力、整数体力、满体力封顶、倒计时、间隔通知时间、格式化 |
| [tests/db.test.js](file:///workspace/tests/db.test.js) | `TimerDB` | CRUD、id/createdAt/updatedAt 分配、字段保留、不存在时 reject |
| [tests/notify.test.js](file:///workspace/tests/notify.test.js) | `NotificationService` | 支持检测、权限检测、iOS/standalone 检测、SW 通知优先、降级通知 |
| [tests/utils.test.js](file:///workspace/tests/utils.test.js) | `escapeHtml` / `validateColor` | XSS 转义、颜色格式校验、默认值 |

**测试用例总数**：82 个（覆盖体力计算、数据库、通知、工具函数和应用逻辑）。

### 11.3 测试技巧

- **mock 模块**：`app.test.js` 使用 `vi.mock` 替换 `db.js` 与 `notify.js`，专注测试阈值检测逻辑
- **时间固定**：`timer.test.js` 通过覆写 `Date.now` 固定时间，验证时间驱动计算
- **navigator 改写**：jsdom 中 `navigator` 只读，用 `Object.defineProperty` 改写 `userAgent` / `standalone` / `serviceWorker`
- **fake-indexeddb**：`tests/setup.js` 全局注入，让 Node 环境直接测试真实 IndexedDB 代码路径

---

## 12. 部署方式

### 12.1 纯静态托管（推荐）

由于是纯前端 PWA，可部署到任意静态托管服务：

- **Vercel**：根目录直接部署
- **GitHub Pages**：`/` 作为根路径
- **Netlify**：构建命令留空，发布目录为根
- **Cloudflare Pages**：见 `wrangler.jsonc` 配置

### 12.2 Cloudflare Pages 配置（[wrangler.jsonc](file:///workspace/wrangler.jsonc)）

```jsonc
{
  "name": "stamina-timer-pwa",
  "compatibility_date": "2026-07-11",
  "observability": { "enabled": true },
  "assets": { "directory": "." },
  "compatibility_flags": ["nodejs_compat"]
}
```

### 12.3 自托管

将整个仓库目录通过任意静态服务器（Nginx / Apache / Caddy）暴露即可，无需构建步骤。

---

## 13. 安全与兼容性

### 13.1 安全措施

| 措施 | 位置 | 说明 |
|------|------|------|
| **XSS 防护** | `utils.escapeHtml` | 所有用户输入在插入 innerHTML 前转义 |
| **颜色格式校验** | `utils.validateColor` | 仅接受 `#RRGGBB`，非法值降级为默认色 |
| **路径遍历防护** | `server.mjs` | 检查 `filePath.startsWith(ROOT)`，拒绝越界请求 |
| **通知去重** | `checkNotificationThreshold` | `lastNotifiedStamina` + `tag` 双重防重复 |
| **输入校验** | `app.js` 表单提交 | 名称非空、数值范围、当前体力不超过上限 |

### 13.2 兼容性

- **iOS 通知**：必须先"添加到主屏幕"（standalone 模式）才能使用通知，`requestPermission` 会前置检测并给出明确提示
- **iOS 安装引导**：非 standalone 模式下显示"添加到主屏幕"步骤浮层
- **iOS 安全区**：`body` 使用 `env(safe-area-inset-top)` 适配 black-translucent 状态栏
- **后台标签页通知**：优先使用 Service Worker 通知，比 `new Notification` 更可靠
- **旧数据兼容**：启动时为缺少 `lastNotifiedStamina` 的记录补默认值
- **切回前台刷新**：`visibilitychange` 监听，避免后台标签页时间误差

---

## 14. 已知限制与设计取舍

### 14.1 已知限制

1. **App 完全关闭后无法通知**：v1.2 砍掉了 Web Push 后端，依赖 app 进程存活才能轮询触发通知
2. **数据不跨设备同步**：所有数据存于本地 IndexedDB，无账号体系
3. **后台标签页节流**：浏览器可能降低 `setInterval` 频率，切回前台时通过 `visibilitychange` 立即刷新补偿
4. **iOS 通知依赖 standalone**：iOS Safari 普通标签页无法使用 Notification API

### 14.2 设计取舍

| 取舍点 | 选择 | 理由 |
|--------|------|------|
| 框架 vs 原生 | 原生 ES Modules | 零运行时依赖，轻量易维护，PWA 体积最小 |
| 后端通知 vs 本地通知 | 本地通知 | 砍掉 Redis/Cron/VAPID 复杂度，符合"app 常驻"使用场景 |
| 体力存储 vs 时间戳计算 | 时间戳计算 | 无需后台运行即可恢复进度，精度高 |
| 缓存策略 | 网络/缓存分流 | HTML 网络优先保证更新，静态资源缓存优先保证离线 |
| 数据库封装 | 纯 CRUD 不含业务 | db.js 可独立测试，业务逻辑集中在 app.js |
| 图标生成 | 纯 JS PNG 字节流 | 避免 canvas 原生模块编译依赖 |

---

## 附录：关键文件索引

| 文件 | 用途 |
|------|------|
| [index.html](file:///workspace/index.html) | 应用入口 |
| [manifest.json](file:///workspace/manifest.json) | PWA 清单 |
| [sw.js](file:///workspace/sw.js) | Service Worker |
| [server.mjs](file:///workspace/server.mjs) | 本地开发服务器 |
| [js/app.js](file:///workspace/js/app.js) | 应用主类 |
| [js/db.js](file:///workspace/js/db.js) | IndexedDB 封装 |
| [js/timer.js](file:///workspace/js/timer.js) | 体力计算 |
| [js/notify.js](file:///workspace/js/notify.js) | 通知服务 |
| [js/utils.js](file:///workspace/js/utils.js) | 工具函数 |
| [css/style.css](file:///workspace/css/style.css) | 全局样式 |
| [scripts/generate-icons.js](file:///workspace/scripts/generate-icons.js) | 图标生成 |
| [tests/setup.js](file:///workspace/tests/setup.js) | 测试环境初始化 |
| [vitest.config.js](file:///workspace/vitest.config.js) | 测试配置 |
| [package.json](file:///workspace/package.json) | npm 元信息 |
| [wrangler.jsonc](file:///workspace/wrangler.jsonc) | Cloudflare 部署配置 |
| [游戏体力计时器.md](file:///workspace/游戏体力计时器.md) | 原始方案设计文档 |

---

*本文档基于仓库当前状态（v1.2.2）审查生成。*
