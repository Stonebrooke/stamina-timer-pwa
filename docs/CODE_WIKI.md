# 游戏体力计时器 PWA — Code Wiki

> 版本：v1.2.2 ｜ 文档类型：代码结构化说明（Code Wiki）
> 本文档基于实际仓库代码分析生成，覆盖项目整体架构、模块职责、关键类与函数、依赖关系及运行方式。

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目整体架构](#2-项目整体架构)
3. [目录结构](#3-目录结构)
4. [主要模块职责](#4-主要模块职责)
5. [关键类与函数说明](#5-关键类与函数说明)
6. [依赖关系](#6-依赖关系)
7. [项目运行方式](#7-项目运行方式)
8. [测试体系](#8-测试体系)
9. [部署方式](#9-部署方式)
10. [关键设计决策与已知限制](#10-关键设计决策与已知限制)

---

## 1. 项目概述

**游戏体力计时器 PWA** 是一个纯前端的渐进式 Web 应用（Progressive Web App），用于追踪多个游戏的体力恢复进度。它采用原生 ES Modules 开发，**零运行时依赖**，支持离线使用、可安装到手机/桌面，并通过本地通知提醒玩家"体力已满"或"恢复到指定阈值"。

### 核心特性

- **多游戏管理**：同时追踪多个游戏的体力恢复
- **实时倒计时**：每秒更新体力数值与恢复倒计时
- **通知提醒**：满体力通知 + 间隔通知（每恢复 N 点提醒一次）
- **PWA 支持**：可安装到桌面/主屏幕，离线可用
- **本地存储**：数据保存在 IndexedDB，无需账号
- **主题色自定义**：每个计时器可设置独立主题色
- **响应式设计**：适配手机和桌面

### 技术栈

| 技术 | 用途 |
|------|------|
| 原生 JavaScript (ES Modules) | 应用逻辑，零框架依赖 |
| IndexedDB（原生 API） | 本地数据持久化 |
| Service Worker | 离线缓存 + 通知点击处理 |
| Web Notifications API | 体力通知 |
| Vitest + jsdom + fake-indexeddb | 单元测试 |
| Node.js 内置模块 | 零依赖本地开发服务器 |

---

## 2. 项目整体架构

### 2.1 架构总览

项目采用 **分层 + 单向数据流** 架构，核心思想是"业务逻辑与数据访问分离"，所有计算基于时间戳实时推导而非后台轮询。

```
┌─────────────────────────────────────────────────────────┐
│                     浏览器 / PWA 运行时                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  index.html (DOM 骨架 + 模态框 + iOS 安装引导)     │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │ 加载                          │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │            js/app.js (StaminaApp 编排层)           │  │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────┐  │  │
│  │  │ 渲染/UI   │  │ 事件绑定    │  │ 通知阈值轮询   │  │  │
│  │  │ render()  │  │ bindEvents │  │ checkNotify.. │  │  │
│  │  └────┬─────┘  └─────┬──────┘  └──────┬────────┘  │  │
│  │       │              │                │            │  │
│  └───────┼──────────────┼────────────────┼────────────┘  │
│          │              │                │               │
│          ▼              ▼                ▼               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ js/timer.js  │ │   js/db.js   │ │   js/notify.js   │  │
│  │ 体力计算核心  │ │ IndexedDB    │ │ Notification API │  │
│  │ (纯函数/无副作用)│ │  (纯 CRUD)   │ │  (本地通知封装)   │  │
│  └──────────────┘ └──────────────┘ └──────────────────┘  │
│          │              │                │               │
│          ▼              ▼                ▼               │
│  ┌──────────────────────────────────────────────────┐    │
│  │             js/utils.js (XSS 防护 + Toast)        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │           sw.js (Service Worker)                  │    │
│  │  离线缓存(导航网络优先/静态缓存优先) + 通知点击      │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 分层职责

| 层级 | 文件 | 职责 | 依赖方向 |
|------|------|------|----------|
| **编排层** | `js/app.js` | DOM 渲染、事件绑定、CRUD 编排、通知阈值轮询 | → 计算层 / 数据层 / 通知层 / 工具层 |
| **计算层** | `js/timer.js` | 纯函数体力计算（精确值/整数值/倒计时/阈值） | 无依赖（纯函数） |
| **数据层** | `js/db.js` | IndexedDB 封装，纯 CRUD，零业务逻辑 | 无依赖（原生 IndexedDB） |
| **通知层** | `js/notify.js` | Notification API 封装，权限管理与通知发送 | 无依赖（原生 API） |
| **工具层** | `js/utils.js` | XSS 防护（escapeHtml/validateColor）+ Toast | 无依赖 |
| **缓存层** | `sw.js` | Service Worker：离线缓存策略 + 通知点击 | 独立运行（Worker 线程） |

### 2.3 核心运行时数据流

```
用户操作/定时器(1s)
        │
        ▼
   updateDisplay()  ──→ StaminaCalculator.getCurrentStamina(timer)  ──→ 更新 UI
        │
        └──→ checkNotificationThreshold(timer, current)
                    │
                    ├─ 跨越阈值? ──→ TimerDB.updateTimer(lastNotifiedStamina)  [持久化]
                    │            ──→ NotificationService.notify(timer, type)   [发通知]
                    │
                    └─ 未跨越 ──→ 无操作
```

**关键点**：体力值不是"累加"出来的，而是基于 `(Date.now() - timer.startTime) / recoveryMinutes` 实时推导。app 关闭重开后无需补偿计算，`startTime` + `currentStamina` 构成基准快照。

---

## 3. 目录结构

```
stamina-timer-pwa/
├── index.html                 # 应用入口 HTML（DOM 骨架 + 模态框 + iOS 安装引导）
├── manifest.json              # PWA 安装清单
├── sw.js                      # Service Worker（缓存 + 通知点击）
├── server.mjs                 # 零依赖静态文件服务器（Node.js 内置模块）
├── start.ps1                  # Windows 便捷启动脚本（端口探测 + 自动开浏览器）
├── package.json               # 项目元数据 + 脚本（仅 devDependencies）
├── package-lock.json          # 依赖锁
├── vitest.config.js           # Vitest 测试配置（jsdom 环境）
├── wrangler.jsonc             # Cloudflare Pages/Workers 部署配置
├── .assetsignore              # Cloudflare 资源忽略清单
├── .gitignore
├── README.md
├── 游戏体力计时器.md           # 项目方案/演进设计文档
├── css/
│   └── style.css              # 全部样式（深色主题 + 响应式）
├── js/
│   ├── app.js                 # 应用主类 StaminaApp + checkNotificationThreshold
│   ├── db.js                  # TimerDB — IndexedDB CRUD 封装
│   ├── timer.js               # StaminaCalculator — 体力计算核心（纯函数）
│   ├── notify.js              # NotificationService — 本地通知服务
│   └── utils.js               # escapeHtml / validateColor / showToast
├── icons/
│   ├── icon-192.png           # 192x192 PWA 图标
│   ├── icon-512.png           # 512x512 PWA 图标
│   └── icon-maskable-512.png  # Android 自适应图标（maskable）
├── scripts/
│   └── generate-icons.js      # 图标生成脚本（纯 JS PNG 编码，零原生依赖）
├── tests/
│   ├── setup.js               # 测试环境初始化（fake-indexeddb + crypto polyfill）
│   ├── app.test.js            # checkNotificationThreshold 单测
│   ├── timer.test.js          # StaminaCalculator 单测
│   ├── db.test.js             # TimerDB 单测
│   ├── notify.test.js         # NotificationService 单测
│   ├── utils.test.js          # escapeHtml / validateColor 单测
│   └── screenshots/           # 手动测试截图
├── docs/
│   └── superpowers/plans/     # 实施计划文档（TDD 任务分解）
└── stamina-timer-guide/       # 项目详细说明（HTML 版）
```

---

## 4. 主要模块职责

### 4.1 `js/timer.js` — 体力计算核心（纯函数层）

**职责**：提供所有体力相关的数学计算，全部为静态方法、纯函数、无副作用、无 DOM 依赖，是整个应用中最易测试的层。

**核心设计**：拆分"精确体力"与"显示体力"双模式。精确值（含小数）用于倒计时平滑递减与阈值检测；显示值（截断整数）用于 UI 展示。

### 4.2 `js/db.js` — 数据访问层（纯 CRUD）

**职责**：封装原生 IndexedDB API，提供计时器的增删改查。**只负责数据读写，不含任何业务逻辑**（`startTime` 重置、体力基准计算等业务由 `app.js` 处理后传入）。

**数据模型**：单一对象存储 `timers`，以 `id`（UUID 字符串）为主键，建立 `createdAt`、`name` 索引。`getAllTimers` 通过 `createdAt` 索引保证返回顺序按创建时间稳定。

### 4.3 `js/notify.js` — 通知服务层

**职责**：封装 Web Notifications API，处理通知权限请求、设备检测（iOS/standalone）、通知发送。优先使用 Service Worker 通知（后台标签页也能显示），降级使用普通 `Notification`。

### 4.4 `js/app.js` — 应用编排层

**职责**：应用主类 `StaminaApp`，统领整个应用生命周期。负责：
- Service Worker 注册与数据加载初始化
- DOM 渲染（计时器卡片列表）
- 事件绑定（新建/编辑/删除、通知授权、PWA 安装、模态框交互）
- 每秒更新循环（UI 刷新 + 通知阈值轮询检测）
- 计时器 CRUD 编排（组装业务字段后调用数据层）
- PWA 安装提示处理（`beforeinstallprompt` + iOS 安装引导浮层）

同时导出独立纯函数 `checkNotificationThreshold`，便于单元测试。

### 4.5 `js/utils.js` — 工具层

**职责**：XSS 防护函数（`escapeHtml` / `validateColor`）与非阻塞 Toast 通知（`showToast`）。所有用户输入在拼入 `innerHTML` 前必须经过转义。

### 4.6 `sw.js` — Service Worker

**职责**：
- **安装**：预缓存静态资源清单
- **激活**：清理旧版本缓存
- **请求拦截**：分策略处理——导航请求（HTML）网络优先降级缓存；静态资源缓存优先降级网络
- **通知点击**：聚焦已有窗口或打开新窗口

### 4.7 `server.mjs` — 开发服务器

**职责**：零依赖静态文件服务器，仅使用 Node.js 内置模块（`http`/`fs`/`path`/`url`）。包含路径遍历防护、MIME 类型映射、`Cache-Control: no-cache`。监听 `127.0.0.1`，端口可通过 `PORT` 环境变量配置。

### 4.8 `scripts/generate-icons.js` — 图标生成

**职责**：纯 JavaScript PNG 生成器，使用 Node.js 内置 `zlib` 模块压缩，无任何原生模块依赖。绘制时钟图标（外圆轮廓 + 时针/分针 + 中心点），支持生成普通图标与 maskable 图标（带 10% 安全区 padding）。

---

## 5. 关键类与函数说明

### 5.1 `StaminaCalculator`（[js/timer.js](file:///workspace/js/timer.js)）

体力计算核心类，全部为静态方法、纯函数。

| 方法 | 签名 | 说明 |
|------|------|------|
| `getExactStamina` | `(timer) → number` | 精确体力值（含小数）。`(now - startTime)/60000 / recoveryMinutes + currentStamina`，封顶 `maxStamina`。用于倒计时与阈值检测 |
| `getCurrentStamina` | `(timer) → number` | 当前体力值（`Math.floor` 截断整数），用于 UI 显示 |
| `timeToFull` | `(timer) → number` | 距满体力毫秒数。基于精确值计算，确保倒计时每秒平滑递减；已满返回 0 |
| `timeToNextNotify` | `(timer) → number\|null` | 距下次间隔通知毫秒数。`notifyInterval≤0` 或已满返回 `null`（保留作工具函数） |
| `getNextNotifyStamina` | `(timer) → number\|null` | 下次通知目标体力值，封顶 `maxStamina`（保留作工具函数） |
| `formatDuration` | `(ms) → string` | 格式化为"X小时Y分"或"Z分钟"，≤0 返回"已满" |
| `formatCountdown` | `(ms) → string` | 格式化为 `HH:MM:SS` 精确倒计时，≤0 返回"00:00:00" |

### 5.2 `TimerDB`（[js/db.js](file:///workspace/js/db.js)）

IndexedDB CRUD 封装类，全部静态方法。

| 方法 | 签名 | 说明 |
|------|------|------|
| `getAllTimers` | `() → Promise<Timer[]>` | 通过 `createdAt` 索引获取全部计时器（按创建时间排序） |
| `getTimer` | `(id) → Promise<Timer\|undefined>` | 按主键 id 查询单条 |
| `addTimer` | `(timer) → Promise<Timer>` | 写入计时器。**自动分配** `id`（`crypto.randomUUID()`）、`createdAt`、`updatedAt`；业务字段由调用方组装 |
| `updateTimer` | `(id, changes) → Promise<Timer>` | 合并更新（`Object.assign` + 更新 `updatedAt`）。记录不存在时 reject `'Timer not found'` |
| `deleteTimer` | `(id) → Promise<void>` | 按主键删除 |

**模块级常量**：`DB_NAME = 'StaminaTimerDB'`，`DB_VERSION = 2`。`onupgradeneeded` 中创建 `timers` store 与索引；v2 升级时移除历史遗留的 `pushSubscriptions` store。

### 5.3 `NotificationService`（[js/notify.js](file:///workspace/js/notify.js)）

本地通知封装类，全部静态方法。

| 方法 | 签名 | 说明 |
|------|------|------|
| `isSupported` | `() → boolean` | 检测 `'Notification' in window` |
| `isPermitted` | `() → boolean` | 是否支持且权限为 `granted` |
| `isIOS` | `() → boolean` | UA 检测 iPad/iPhone/iPod |
| `isStandalone` | `() → boolean` | `display-mode: standalone` 或 `navigator.standalone === true` |
| `requestPermission` | `() → Promise<{granted, reason}>` | 请求权限。**前置 iOS standalone 检测**，未安装时返回引导提示而非报错；已 `granted`/`denied` 直接返回 |
| `notify` | `(timer, type, targetStamina) → Promise` | 发送通知。`type` 为 `'full'`/`'interval'`；优先 SW `showNotification`，降级 `new Notification`。`tag` 格式 `stamina-{id}-{type}-{targetStamina}` 去重，`requireInteraction: true` |

### 5.4 `StaminaApp`（[js/app.js](file:///workspace/js/app.js)）

应用主类，编排所有模块。

| 成员 | 说明 |
|------|------|
| `constructor()` | 初始化 `this.timers = []`，调用 `init()` |
| `async init()` | 注册 SW → `TimerDB.getAllTimers()` 加载数据 → 兼容旧数据补全 `lastNotifiedStamina` 并持久化 → `render()` → `startUpdateLoop()` → `bindEvents()` → 恢复通知按钮状态 → `setupInstallPrompt()` |
| `bindEvents()` | 绑定新建按钮、通知按钮、取消按钮、模态框遮罩点击关闭、Escape 键关闭、表单提交（含输入校验：名称非空、上限≥1、当前体力≥0 且≤上限、恢复间隔≥1） |
| `startUpdateLoop()` | `setInterval(updateDisplay, 1000)` + `visibilitychange` 监听（页面切回前台立即刷新） |
| `updateDisplay()` | 遍历 timers：计算体力/倒计时 → 更新 DOM（数值/进度条/is-full 类） → 调用 `checkNotificationThreshold` |
| `addTimer(formData)` | 组装 timer 对象（含 `startTime = Date.now()`、`lastNotifiedStamina = currentStamina`）→ `TimerDB.addTimer` → push 到内存 → `render()` |
| `updateTimer(id, formData)` | 组装变更（**重置 `startTime` 与 `lastNotifiedStamina`**）→ `TimerDB.updateTimer` → 替换内存条目 → `render()` |
| `deleteTimer(id)` | `confirm` 确认 → `TimerDB.deleteTimer` → 过滤内存 → `render()`（含 try-catch） |
| `editTimer(id)` | 查找内存条目 → `showEditModal(timer)` |
| `enableNotifications()` | 调用 `NotificationService.requestPermission`，成功更新按钮状态 + Toast |
| `setupInstallPrompt()` | 捕获 `beforeinstallprompt` 显示安装按钮；`appinstalled` 隐藏按钮；iOS 非 standalone 显示安装引导浮层（sessionStorage 记忆关闭） |
| `showAddModal()` / `showEditModal(timer)` | 打开模态框（记录触发元素用于焦点恢复）；编辑模式预填表单，`currentStamina` 用 `Math.round(getExactStamina())` 避免丢失小数进度 |
| `closeModal()` | 隐藏模态框 + 焦点回到触发元素 |
| `render()` | 清空容器 → 空状态提示 / 遍历生成卡片（`escapeHtml` 转义 + `validateColor` 设置 `--theme-color` + `addEventListener` 绑定编辑/删除）→ `updateDisplay()` |

**自动启动守卫**：仅当 `typeof document !== 'undefined' && document.getElementById('timer-list')` 时实例化 `StaminaApp`，避免在测试环境（jsdom 无此 DOM）自动启动崩溃。

### 5.5 `checkNotificationThreshold`（[js/app.js](file:///workspace/js/app.js)）

导出的独立纯函数，便于单元测试。

```
function checkNotificationThreshold(timer, current):
  lastNotified = timer.lastNotifiedStamina ?? current
  if current <= lastNotified: return           # 未增长，跳过

  if notifyAtFull && current >= maxStamina && lastNotified < maxStamina:
      notifyType = 'full', target = maxStamina
  elif notifyInterval > 0 && current < maxStamina:
      highestCrossed = floor(current/interval)*interval
      if highestCrossed > lastNotified && highestCrossed < maxStamina:
          notifyType = 'interval', target = highestCrossed

  if notifyType:
      timer.lastNotifiedStamina = current       # 同步更新防重复
      TimerDB.updateTimer(id, {lastNotifiedStamina})  # 异步持久化
      if NotificationService.isPermitted():
          NotificationService.notify(timer, notifyType, target)
```

**关键点**：取"最近跨越的阈值"（`floor(current/interval)*interval`，不加 `-1`），避免 app 关闭后通知内容与实际体力不符，同时防止恰好等于阈值时漏检。

### 5.6 工具函数（[js/utils.js](file:///workspace/js/utils.js)）

| 函数 | 说明 |
|------|------|
| `escapeHtml(str)` | 通过 `document.createElement('div').textContent` 转义 HTML 特殊字符，防 XSS |
| `validateColor(color)` | 正则校验 `#RRGGBB`，非法返回默认色 `#4a90d9` |
| `showToast(message, type, duration)` | 非阻塞 Toast（最多同时 3 条），支持 `info`/`error`/`success` 类型，带入场/出场动画 |

### 5.7 Service Worker 关键逻辑（[sw.js](file:///workspace/sw.js)）

- **缓存名**：`stamina-timer-v2.2`（版本升级时旧缓存自动清理）
- **预缓存清单**：`/`、`/index.html`、`/css/style.css`、全部 `/js/*.js`、`/manifest.json`、3 个图标
- **fetch 策略**：
  - `request.mode === 'navigate'`（HTML 页面）：**网络优先**，成功后回写缓存，失败降级缓存
  - 其他静态资源：**缓存优先**，未命中走网络并回写缓存
- **install**：`skipWaiting()` 立即激活新 SW
- **activate**：清理非当前版本缓存 + `clients.claim()` 立即接管
- **notificationclick**：关闭通知 → 聚焦已有窗口 / 打开新窗口 `/`

### 5.8 数据模型（Timer Schema）

```
{
  id: 'uuid-string',          // 主键（crypto.randomUUID）
  name: '原神',                // 游戏名称
  maxStamina: 160,             // 体力上限
  currentStamina: 120,         // 基准体力值（对应 startTime 时刻）
  recoveryMinutes: 8,          // 每点恢复分钟数
  startTime: 1690123456789,    // 基准时间戳(ms)，currentStamina 对应此时刻
  notifyAtFull: true,          // 满体力通知开关
  notifyInterval: 40,          // 间隔通知阈值（0=不通知）
  lastNotifiedStamina: 120,    // 上次通知体力值（轮询去重）
  color: '#4a90d9',            // 主题色
  createdAt: 1690123456789,    // 创建时间（db.js 分配）
  updatedAt: 1690123456789     // 更新时间（db.js 维护）
}
```

---

## 6. 依赖关系

### 6.1 模块导入依赖图

```
app.js ──import──→ db.js        (TimerDB)
      ──import──→ timer.js    (StaminaCalculator)
      ──import──→ notify.js   (NotificationService)
      ──import──→ utils.js    (escapeHtml, validateColor, showToast)

timer.js   → 无导入（纯函数）
db.js      → 无导入（原生 IndexedDB）
notify.js  → 无导入（原生 Notification API）
utils.js   → 无导入（原生 DOM）
sw.js      → 独立运行（Worker 线程，无 ES Module 导入）

index.html ──script──→ /js/app.js (type="module")
          ──link──→   /css/style.css, /manifest.json
```

**依赖特征**：
- **单向无环**：`app.js` 是唯一汇聚点，下层模块互不依赖
- **零运行时第三方依赖**：所有业务代码仅使用浏览器原生 API
- **计算层/数据层/通知层互相独立**：可单独替换或测试

### 6.2 运行时依赖（浏览器 API）

| API | 使用位置 |
|-----|----------|
| IndexedDB | `db.js` |
| `crypto.randomUUID()` | `db.js`（生成 id） |
| Notification API | `notify.js` |
| Service Worker API | `app.js`（注册）、`sw.js` |
| Cache API | `sw.js` |
| `matchMedia` / `navigator.standalone` | `notify.js`、`app.js`（standalone 检测） |
| `beforeinstallprompt` / `appinstalled` 事件 | `app.js`（PWA 安装） |
| `setInterval` / `visibilitychange` | `app.js`（更新循环） |

### 6.3 开发依赖（package.json devDependencies）

| 依赖 | 用途 |
|------|------|
| `vitest` ^2.0.0 | 单元测试框架 |
| `fake-indexeddb` ^6.0.0 | Node 环境模拟 IndexedDB |
| `jsdom` ^25.0.0 | Node 环境模拟 DOM |
| `canvas` ^2.11.2 | 图标生成（历史依赖，当前 `generate-icons.js` 已改用纯 zlib 实现，不再需要） |

> 注：`package.json` 中 `"allowScripts": {}`，无 postinstall 脚本风险。

---

## 7. 项目运行方式

### 7.1 环境要求

- **Node.js 18+**（开发服务器与测试用）
- **现代浏览器**（支持 ES Modules、IndexedDB、Service Worker、Notification API）

### 7.2 本地开发启动

```bash
# 方式一：npm 脚本（零 npm install 即可启动服务器，测试除外）
npm start
# 或
node server.mjs
```

启动后访问 `http://localhost:3000`。服务器监听 `127.0.0.1`，端口可通过 `PORT` 环境变量覆盖。按 `Ctrl+C` 停止。

**Windows 便捷方式**：双击 `start.ps1`，自动探测 Node.js、探测可用端口（3000→3001→3002）、启动服务器、等待就绪、打开默认浏览器。

### 7.3 npm 脚本

| 命令 | 作用 |
|------|------|
| `npm start` / `npm run serve` | 启动零依赖静态服务器（`node server.mjs`） |
| `npm test` | 运行全部单元测试（`vitest run`） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run generate-icons` | 重新生成 PWA 图标 |

### 7.4 使用流程

1. 访问应用地址，点击「+ 新建计时器」
2. 填写游戏名称、体力上限、当前体力、恢复间隔
3. 可选：开启满体力通知、设置间隔通知阈值、选择主题色
4. 点击「保存」开始追踪
5. 点击 ⚙️ 编辑、🗑️ 删除计时器
6. 点击「🔔 开启通知」授权后，体力回满或达阈值时收到系统通知

### 7.5 PWA 安装

| 平台 | 安装方式 |
|------|----------|
| Android Chrome | 菜单 →「添加到主屏幕」 |
| iOS Safari | 分享 →「添加到主屏幕」（应用内会显示安装引导浮层） |
| 桌面 Chrome/Edge | 地址栏安装图标 →「安装」（或捕获 `beforeinstallprompt` 显示的「📲 安装应用」按钮） |

---

## 8. 测试体系

### 8.1 测试配置

- **框架**：Vitest（`vitest.config.js`）
- **环境**：`jsdom` + `globals: true`
- **setup**：`tests/setup.js` 引入 `fake-indexeddb/auto`，并 polyfill `crypto.randomUUID`
- **范围**：`tests/**/*.test.js`

### 8.2 测试覆盖（共 82 个用例）

| 测试文件 | 被测对象 | 覆盖内容 |
|----------|----------|----------|
| `tests/timer.test.js` | `StaminaCalculator` | 精确/整数体力、`timeToFull`、`timeToNextNotify`、`getNextNotifyStamina`、`formatDuration`、`formatCountdown`（含边界、封顶、舍入） |
| `tests/db.test.js` | `TimerDB` | 增删改查、id/createdAt/updatedAt 分配、字段保留、不存在记录 reject |
| `tests/notify.test.js` | `NotificationService` | 支持检测、权限状态、iOS/standalone 检测、`requestPermission` 各分支、`notify` 走 SW/降级 Notification、通知文案构造 |
| `tests/utils.test.js` | `escapeHtml` / `validateColor` | XSS 转义、颜色校验各分支 |
| `tests/app.test.js` | `checkNotificationThreshold` | 通过 `vi.mock` 隔离 db/notify，覆盖满体力/间隔通知触发、去重、未授权、undefined 兼容 |

### 8.3 运行测试

```bash
npm test          # 运行所有测试
npm run test:watch # 监听模式
```

---

## 9. 部署方式

项目为纯静态站点，无后端，任意静态托管平台均可。

### 9.1 Cloudflare Pages（`wrangler.jsonc`）

配置已就绪：`assets.directory` 指向项目根目录，启用 `nodejs_compat` 兼容标志与可观测性。`.assetsignore` 排除 `.git`、`.wrangler`、`node_modules`、`.DS_Store`、`*.log`。

### 9.2 其他平台

| 平台 | 配置 |
|------|------|
| Vercel | 框架选 "Other"，输出目录为项目根目录，自动提供 HTTPS |
| GitHub Pages | `git subtree push --prefix . origin gh-pages` |
| Netlify | Build command 留空，Publish directory 为 `.` |

> PWA 的 Service Worker 与 Notification API 均要求 **HTTPS**（localhost 除外），部署后务必使用 HTTPS 域名。

---

## 10. 关键设计决策与已知限制

### 10.1 关键设计决策

1. **纯前端无后端**：v1.2 砍掉了 v1.1 的 Web Push + 后端调度方案（Redis/Cron/VAPID），改为本地 `Notification API` + 轮询检测。理由：用户场景为 app 常驻运行，后端复杂度不划算。
2. **时间戳推导体力**：体力值实时由 `(now - startTime) / recoveryMinutes` 推导，app 重开无需补偿计算，`startTime + currentStamina` 是基准快照。
3. **精确值/显示值双模式**：`getExactStamina`（含小数）用于倒计时平滑递减与阈值检测，`getCurrentStamina`（截断整数）用于 UI，避免倒计时"卡住"每 N 分钟才跳一次。
4. **层级职责分离**：`db.js` 纯 CRUD（不 import 任何业务模块），业务逻辑（`startTime` 重置等）集中在 `app.js`，提升可测试性。
5. **XSS 防护**：所有用户输入经 `escapeHtml` 转义后才拼入 `innerHTML`；`render` 改用 `addEventListener` 替代内联 `onclick`。
6. **通知去重**：`lastNotifiedStamina` 持久化到 IndexedDB，app 重启后不重复通知已过去的阈值。
7. **测试友好**：`checkNotificationThreshold` 导出为独立函数，`StaminaApp` 自动启动加守卫，测试用 `vi.mock` 隔离依赖。

### 10.2 已知限制

> 通知依赖 JavaScript 持续运行，这是纯前端方案的根本限制：

1. **app 完全关闭**（标签页关闭/PWA 进程终止）：**无法接收任何通知**。
2. **iOS 后台**：iOS 将 app 切后台后 JS 执行被完全冻结，`setInterval` 停止，**后台不收通知**；仅前台可用。`visibilitychange` 监听可在切回前台时立即刷新并补检阈值。
3. **桌面后台标签页**：`setInterval` 被节流到约每分钟 1 次，通知可能延迟最多 1 分钟；PWA 安装为独立窗口后不受此限制。
4. 若需"app 关闭后也能收通知"，需重新引入 Web Push + 轻量后端（见后续优化方向）。

### 10.3 后续优化方向

- Web Push（可选扩展，不破坏纯前端核心）
- 多设备数据同步（需账号系统）
- 自定义通知文案/音效/震动
- 体力使用历史统计与曲线图表
- 内置常见游戏预设模板（原神、崩坏星穹铁道、绝区零等）

---

*本文档由代码仓库实际分析生成，与 `README.md`（用户向）与 `游戏体力计时器.md`（方案/演进向）互补，面向开发者提供代码级结构说明。*
