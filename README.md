# ⏱️ 游戏体力计时器 PWA

追踪多个游戏体力恢复进度的渐进式 Web 应用（PWA），支持本地通知提醒，离线可用，可安装到手机桌面。

## ✨ 功能特性

- **多游戏管理**：同时追踪多个游戏的体力恢复进度
- **实时倒计时**：每秒更新体力数值和恢复倒计时
- **通知提醒**：
  - 满体力通知（体力回满时提醒）
  - 间隔通知（每恢复 N 点提醒一次）
- **PWA 支持**：可安装到手机/桌面桌面，离线可用
- **本地存储**：数据保存在 IndexedDB，无需账号
- **主题色自定义**：每个计时器可设置独立主题色
- **响应式设计**：适配手机和桌面

## 🚀 快速开始

### 方式一：双击启动（推荐）

Windows 用户直接双击 `start.bat`，脚本会自动：
1. 检测 Node.js
2. 探测可用端口（3000-3002）
3. 启动本地服务器
4. 打开浏览器

按 `Ctrl+C` 停止服务器。

### 方式二：手动启动

需要 Node.js 18+ 环境：

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run serve
# 或
npx http-server . -p 3000 -c-1
```

浏览器访问 `http://localhost:3000`。

## 📖 使用说明

1. 点击「+ 新建计时器」创建游戏计时器
2. 填写游戏名称、体力上限、当前体力、恢复间隔
3. 可选：开启满体力通知、设置间隔通知、选择主题色
4. 点击「保存」即可开始追踪
5. 点击 ⚙️ 编辑、🗑️ 删除计时器

### 开启通知

点击「🔔 开启通知」按钮授权后，体力回满或达到间隔阈值时会收到系统通知。

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| 原生 JavaScript (ES Modules) | 应用逻辑，零框架依赖 |
| IndexedDB | 本地数据持久化 |
| Service Worker | 离线缓存 |
| Web Notifications | 体力通知 |
| Vitest | 单元测试 |
| http-server | 本地开发服务器 |

## 📁 项目结构

```
├── index.html              # 应用入口
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker
├── start.bat / start.ps1   # Windows 双击启动脚本
├── css/
│   └── style.css           # 样式
├── js/
│   ├── app.js              # 应用主类（CRUD、渲染、事件）
│   ├── db.js               # IndexedDB 封装
│   ├── timer.js            # 体力计算逻辑
│   ├── notify.js           # 通知服务
│   └── utils.js            # 工具函数（XSS 防护、Toast）
├── icons/                  # PWA 图标
├── scripts/
│   └── generate-icons.js   # 图标生成脚本
├── tests/                  # 单元测试（82 个）
└── stamina-timer-guide/    # 项目详细文档
```

## 🧪 测试

```bash
npm test          # 运行所有测试
npm run test:watch # 监听模式
```

当前共 82 个单元测试，覆盖体力计算、数据库、通知、工具函数和应用逻辑。

## 📦 安装为 PWA

### Android Chrome
1. 访问应用地址
2. 菜单 →「添加到主屏幕」

### iOS Safari
1. 访问应用地址
2. 分享 →「添加到主屏幕」

### 桌面 Chrome/Edge
1. 访问应用地址
2. 地址栏右侧安装图标 →「安装」

## 📄 License

MIT
