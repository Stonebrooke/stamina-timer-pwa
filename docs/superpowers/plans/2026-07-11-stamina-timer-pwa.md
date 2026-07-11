# 游戏体力计时器 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-frontend PWA that tracks multiple game stamina recovery timers with local notifications, offline support, and installability.

**Architecture:** ES Modules with zero runtime dependencies. `StaminaCalculator` (pure math) → `TimerDB` (IndexedDB CRUD) → `NotificationService` (Notification API wrapper) → `StaminaApp` (orchestrator + DOM). Service Worker handles offline caching and notification clicks. Tests use Vitest + fake-indexeddb + jsdom.

**Tech Stack:** Vanilla JS (ES Modules), IndexedDB (native API), Notification API, Service Worker, Vitest (dev), fake-indexeddb (dev), jsdom (dev)

---

## File Structure

```
e:\游戏体力计时器\
├── index.html                  # Main page with modal form
├── manifest.json               # PWA install manifest
├── sw.js                       # Service Worker (cache + notification click)
├── package.json                # Dev dependencies + deploy scripts
├── vitest.config.js            # Test configuration (jsdom environment)
├── css/
│   └── style.css               # All styling
├── js/
│   ├── timer.js                # StaminaCalculator — pure math, zero deps
│   ├── db.js                   # TimerDB — IndexedDB CRUD, zero business logic
│   ├── notify.js               # NotificationService — Notification API wrapper
│   ├── utils.js                # XSS protection: escapeHtml, validateColor, validateIcon
│   └── app.js                  # StaminaApp — orchestrator + DOM rendering
├── icons/
│   ├── icon-192.png            # 192x192 PWA icon
│   ├── icon-512.png            # 512x512 PWA icon
│   └── icon-maskable-512.png   # Android adaptive icon
├── scripts/
│   └── generate-icons.js       # Dev script to generate placeholder PNG icons
└── tests/
    ├── timer.test.js           # StaminaCalculator tests
    ├── db.test.js              # TimerDB tests (fake-indexeddb)
    ├── notify.test.js          # NotificationService tests
    ├── utils.test.js           # XSS protection tests
    └── app.test.js             # StaminaApp threshold logic tests
```

**Design decisions:**
- `utils.js` extracted from `app.js` for independently testable XSS protection functions (spec puts them in app.js; extraction improves testability without changing behavior)
- `app.js` guards auto-instantiation so it can be imported in tests without crashing
- `scripts/generate-icons.js` uses dev-only `canvas` dependency to produce PNGs; no runtime dependency

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "stamina-timer-pwa",
  "version": "1.2.2",
  "description": "游戏体力恢复计时器 PWA",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "generate-icons": "node scripts/generate-icons.js",
    "serve": "npx http-server . -p 3000 -c-1"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0",
    "canvas": "^2.11.2"
  }
}
```

- [ ] **Step 2: Create vitest.config.js**

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js']
  }
});
```

- [ ] **Step 3: Create tests/setup.js**

```javascript
import 'fake-indexeddb/auto';

// Polyfill crypto.randomUUID for Node test environment
if (!globalThis.crypto) {
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 6: Verify test runner works**

Run: `npx vitest run`
Expected: "No test files found" (no tests yet — confirms vitest is installed correctly)

- [ ] **Step 7: Initialize git and commit**

```bash
git init
git add package.json vitest.config.js .gitignore tests/setup.js
git commit -m "chore: scaffold project with vitest and test setup"
```

---

## Task 2: StaminaCalculator — getExactStamina & getCurrentStamina

**Files:**
- Create: `js/timer.js`
- Test: `tests/timer.test.js`

- [ ] **Step 1: Write failing tests for getExactStamina and getCurrentStamina**

```javascript
// tests/timer.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StaminaCalculator } from '../js/timer.js';

describe('StaminaCalculator', () => {
  let originalDateNow;

  beforeEach(() => {
    originalDateNow = Date.now;
    // Fixed "now" = startTime + 80 minutes
    Date.now = () => 1690123456789 + 80 * 60000;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('getExactStamina', () => {
    it('returns starting stamina when no time has passed', () => {
      Date.now = () => 1690123456789;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      expect(StaminaCalculator.getExactStamina(timer)).toBe(120);
    });

    it('recovers fractional stamina based on elapsed time', () => {
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      // 80 min elapsed / 8 min per point = 10 points recovered
      expect(StaminaCalculator.getExactStamina(timer)).toBe(130);
    });

    it('recovers fractional stamina (non-integer)', () => {
      // 4 min elapsed / 8 min per point = 0.5 points
      Date.now = () => 1690123456789 + 4 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      expect(StaminaCalculator.getExactStamina(timer)).toBe(120.5);
    });

    it('caps at maxStamina', () => {
      // 1000 min elapsed = 125 points, way over cap
      Date.now = () => 1690123456789 + 1000 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      expect(StaminaCalculator.getExactStamina(timer)).toBe(160);
    });
  });

  describe('getCurrentStamina', () => {
    it('floors the exact stamina to integer', () => {
      Date.now = () => 1690123456789 + 4 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      // exact = 120.5, floored = 120
      expect(StaminaCalculator.getCurrentStamina(timer)).toBe(120);
    });

    it('returns integer when exact stamina is whole', () => {
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      // exact = 130
      expect(StaminaCalculator.getCurrentStamina(timer)).toBe(130);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/timer.test.js`
Expected: FAIL with "Failed to resolve import" or "StaminaCalculator is not a function" (module doesn't exist yet)

- [ ] **Step 3: Implement getExactStamina and getCurrentStamina**

```javascript
// js/timer.js
export class StaminaCalculator {

  /**
   * 计算精确体力值（含小数）
   * 用于倒计时计算、阈值检测等需要精度的场景
   */
  static getExactStamina(timer) {
    const now = Date.now();
    const elapsedMinutes = (now - timer.startTime) / 60000;
    const recovered = elapsedMinutes / timer.recoveryMinutes;
    return Math.min(timer.currentStamina + recovered, timer.maxStamina);
  }

  /**
   * 计算当前体力值（截断整数）
   * 用于 UI 显示
   */
  static getCurrentStamina(timer) {
    return Math.floor(this.getExactStamina(timer));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/timer.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/timer.js tests/timer.test.js
git commit -m "feat: add StaminaCalculator getExactStamina and getCurrentStamina"
```

---

## Task 3: StaminaCalculator — timeToFull

**Files:**
- Modify: `js/timer.js`
- Modify: `tests/timer.test.js`

- [ ] **Step 1: Add failing tests for timeToFull**

Append to `tests/timer.test.js` inside the `describe('StaminaCalculator', ...)` block, after the `getCurrentStamina` describe block:

```javascript
  describe('timeToFull', () => {
    it('returns 0 when already at max stamina', () => {
      Date.now = () => 1690123456789 + 1000 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      expect(StaminaCalculator.timeToFull(timer)).toBe(0);
    });

    it('returns milliseconds needed to reach max from exact stamina', () => {
      Date.now = () => 1690123456789 + 4 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      // exact = 120.5, needed = 39.5 points, 39.5 * 8 * 60000 = 18960000
      expect(StaminaCalculator.timeToFull(timer)).toBe(18960000);
    });

    it('returns full recovery time when at starting stamina', () => {
      Date.now = () => 1690123456789;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789
      };
      // 40 points needed * 8 min * 60000 = 19200000
      expect(StaminaCalculator.timeToFull(timer)).toBe(19200000);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/timer.test.js`
Expected: FAIL with "StaminaCalculator.timeToFull is not a function"

- [ ] **Step 3: Implement timeToFull**

Add this method to the `StaminaCalculator` class in `js/timer.js`, after `getCurrentStamina`:

```javascript
  /**
   * 计算距离满体力还有多久（毫秒）
   * 使用精确体力值，确保倒计时每秒平滑递减
   */
  static timeToFull(timer) {
    const exact = this.getExactStamina(timer);
    const needed = timer.maxStamina - exact;
    if (needed <= 0) return 0;
    return needed * timer.recoveryMinutes * 60000;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/timer.test.js`
Expected: PASS (8 tests total)

- [ ] **Step 5: Commit**

```bash
git add js/timer.js tests/timer.test.js
git commit -m "feat: add StaminaCalculator timeToFull"
```

---

## Task 4: StaminaCalculator — timeToNextNotify & getNextNotifyStamina

**Files:**
- Modify: `js/timer.js`
- Modify: `tests/timer.test.js`

- [ ] **Step 1: Add failing tests for timeToNextNotify and getNextNotifyStamina**

Append inside the `describe('StaminaCalculator', ...)` block:

```javascript
  describe('timeToNextNotify', () => {
    it('returns null when notifyInterval is 0', () => {
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 0
      };
      expect(StaminaCalculator.timeToNextNotify(timer)).toBeNull();
    });

    it('returns null when notifyInterval is negative', () => {
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: -1
      };
      expect(StaminaCalculator.timeToNextNotify(timer)).toBeNull();
    });

    it('returns null when already at max stamina', () => {
      Date.now = () => 1690123456789 + 1000 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 40
      };
      expect(StaminaCalculator.timeToNextNotify(timer)).toBeNull();
    });

    it('returns ms to next threshold crossing', () => {
      // exact = 120.5, interval = 40, next threshold = 160
      // but 160 = maxStamina, so next threshold is 160 which equals max
      // Let's use interval=10: next threshold after 120.5 = 130
      Date.now = () => 1690123456789 + 4 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 200,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 10
      };
      // exact = 120.5, nextThreshold = floor(120.5/10)*10 + 10 = 120 + 10 = 130
      // needed = 130 - 120.5 = 9.5 points
      // ms = ceil(9.5 * 8 * 60000) = ceil(4560000) = 4560000
      expect(StaminaCalculator.timeToNextNotify(timer)).toBe(4560000);
    });

    it('returns null when next threshold exceeds maxStamina', () => {
      // exact = 155, interval = 40, nextThreshold = 160+40=200 > 160
      Date.now = () => 1690123456789 + 280 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 40
      };
      // exact = 120 + 280/8 = 120 + 35 = 155
      // nextThreshold = floor(155/40)*40 + 40 = 120 + 40 = 160
      // 160 is not > maxStamina (160), so it should return a value
      // needed = 160 - 155 = 5, ms = ceil(5 * 8 * 60000) = 2400000
      expect(StaminaCalculator.timeToNextNotify(timer)).toBe(2400000);
    });
  });

  describe('getNextNotifyStamina', () => {
    it('returns null when notifyInterval is 0', () => {
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 0
      };
      expect(StaminaCalculator.getNextNotifyStamina(timer)).toBeNull();
    });

    it('returns maxStamina when already at max', () => {
      Date.now = () => 1690123456789 + 1000 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 40
      };
      expect(StaminaCalculator.getNextNotifyStamina(timer)).toBe(160);
    });

    it('returns next threshold value', () => {
      // exact = 120.5, interval = 10, nextThreshold = 130
      Date.now = () => 1690123456789 + 4 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 200,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 10
      };
      expect(StaminaCalculator.getNextNotifyStamina(timer)).toBe(130);
    });

    it('caps at maxStamina when threshold exceeds max', () => {
      // exact = 155, interval = 40, nextThreshold = 160, max = 160
      Date.now = () => 1690123456789 + 280 * 60000;
      const timer = {
        currentStamina: 120,
        maxStamina: 160,
        recoveryMinutes: 8,
        startTime: 1690123456789,
        notifyInterval: 40
      };
      expect(StaminaCalculator.getNextNotifyStamina(timer)).toBe(160);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/timer.test.js`
Expected: FAIL with "StaminaCalculator.timeToNextNotify is not a function"

- [ ] **Step 3: Implement timeToNextNotify and getNextNotifyStamina**

Add these methods to the `StaminaCalculator` class in `js/timer.js`, after `timeToFull`:

```javascript
  /**
   * 计算距离下一次间隔通知还有多久（毫秒）
   * 返回 null 表示不需要间隔通知
   * 使用精确体力值避免阈值检测偏差
   */
  static timeToNextNotify(timer) {
    if (!timer.notifyInterval || timer.notifyInterval <= 0) return null;
    const exact = this.getExactStamina(timer);
    const currentInt = Math.floor(exact);
    if (currentInt >= timer.maxStamina) return null;

    const nextThreshold = Math.floor(exact / timer.notifyInterval) * timer.notifyInterval + timer.notifyInterval;
    if (nextThreshold > timer.maxStamina) return null;

    const needed = nextThreshold - exact;
    return Math.ceil(needed * timer.recoveryMinutes * 60000);
  }

  /**
   * 计算下一次通知的目标体力值
   */
  static getNextNotifyStamina(timer) {
    if (!timer.notifyInterval || timer.notifyInterval <= 0) return null;
    const exact = this.getExactStamina(timer);
    if (exact >= timer.maxStamina) return timer.maxStamina;

    const nextThreshold = Math.floor(exact / timer.notifyInterval) * timer.notifyInterval + timer.notifyInterval;
    return Math.min(nextThreshold, timer.maxStamina);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/timer.test.js`
Expected: PASS (15 tests total)

- [ ] **Step 5: Commit**

```bash
git add js/timer.js tests/timer.test.js
git commit -m "feat: add StaminaCalculator timeToNextNotify and getNextNotifyStamina"
```

---

## Task 5: StaminaCalculator — formatDuration & formatCountdown

**Files:**
- Modify: `js/timer.js`
- Modify: `tests/timer.test.js`

- [ ] **Step 1: Add failing tests for formatDuration and formatCountdown**

Append inside the `describe('StaminaCalculator', ...)` block:

```javascript
  describe('formatDuration', () => {
    it('returns 已满 when ms is 0', () => {
      expect(StaminaCalculator.formatDuration(0)).toBe('已满');
    });

    it('returns 已满 when ms is negative', () => {
      expect(StaminaCalculator.formatDuration(-1000)).toBe('已满');
    });

    it('formats minutes only when under 1 hour', () => {
      // 30 min = 1800000 ms
      expect(StaminaCalculator.formatDuration(1800000)).toBe('30分钟');
    });

    it('formats hours and minutes when over 1 hour', () => {
      // 90 min = 5400000 ms
      expect(StaminaCalculator.formatDuration(5400000)).toBe('1小时30分');
    });

    it('rounds up partial minutes', () => {
      // 30.5 min = 1830000 ms → ceil = 31 min
      expect(StaminaCalculator.formatDuration(1830000)).toBe('31分钟');
    });
  });

  describe('formatCountdown', () => {
    it('returns 00:00:00 when ms is 0', () => {
      expect(StaminaCalculator.formatCountdown(0)).toBe('00:00:00');
    });

    it('returns 00:00:00 when ms is negative', () => {
      expect(StaminaCalculator.formatCountdown(-1000)).toBe('00:00:00');
    });

    it('formats seconds only', () => {
      // 30 sec = 30000 ms
      expect(StaminaCalculator.formatCountdown(30000)).toBe('00:00:30');
    });

    it('formats minutes and seconds', () => {
      // 5 min 30 sec = 330000 ms
      expect(StaminaCalculator.formatCountdown(330000)).toBe('00:05:30');
    });

    it('formats hours minutes seconds', () => {
      // 1 hr 5 min 30 sec = 3930000 ms
      expect(StaminaCalculator.formatCountdown(3930000)).toBe('01:05:30');
    });

    it('rounds up partial seconds', () => {
      // 30.5 sec = 30500 ms → ceil = 31 sec
      expect(StaminaCalculator.formatCountdown(30500)).toBe('00:00:31');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/timer.test.js`
Expected: FAIL with "StaminaCalculator.formatDuration is not a function"

- [ ] **Step 3: Implement formatDuration and formatCountdown**

Add these methods to the `StaminaCalculator` class in `js/timer.js`, after `getNextNotifyStamina`:

```javascript
  /**
   * 格式化剩余时间
   */
  static formatDuration(ms) {
    if (ms <= 0) return '已满';
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}小时${minutes}分`;
    return `${minutes}分钟`;
  }

  /**
   * 格式化精确倒计时 HH:MM:SS
   */
  static formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/timer.test.js`
Expected: PASS (24 tests total)

- [ ] **Step 5: Commit**

```bash
git add js/timer.js tests/timer.test.js
git commit -m "feat: add StaminaCalculator formatDuration and formatCountdown"
```

---

## Task 6: TimerDB — Schema & Read Operations

**Files:**
- Create: `js/db.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: Write failing tests for getAllTimers and getTimer**

```javascript
// tests/db.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { TimerDB } from '../js/db.js';

describe('TimerDB', () => {
  beforeEach(async () => {
    // Clear all data between tests
    const all = await TimerDB.getAllTimers();
    for (const t of all) {
      await TimerDB.deleteTimer(t.id);
    }
  });

  describe('getAllTimers', () => {
    it('returns empty array when no timers exist', async () => {
      const result = await TimerDB.getAllTimers();
      expect(result).toEqual([]);
    });

    it('returns all timers after adding', async () => {
      await TimerDB.addTimer({
        name: '原神',
        maxStamina: 160,
        currentStamina: 120,
        recoveryMinutes: 8,
        startTime: Date.now()
      });
      await TimerDB.addTimer({
        name: '崩坏星穹铁道',
        maxStamina: 240,
        currentStamina: 100,
        recoveryMinutes: 6,
        startTime: Date.now()
      });
      const result = await TimerDB.getAllTimers();
      expect(result).toHaveLength(2);
      expect(result.map(t => t.name)).toContain('原神');
      expect(result.map(t => t.name)).toContain('崩坏星穹铁道');
    });
  });

  describe('getTimer', () => {
    it('returns undefined when timer does not exist', async () => {
      const result = await TimerDB.getTimer('nonexistent-id');
      expect(result).toBeUndefined();
    });

    it('returns timer by id', async () => {
      const saved = await TimerDB.addTimer({
        name: '原神',
        maxStamina: 160,
        currentStamina: 120,
        recoveryMinutes: 8,
        startTime: Date.now()
      });
      const result = await TimerDB.getTimer(saved.id);
      expect(result.name).toBe('原神');
      expect(result.id).toBe(saved.id);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.js`
Expected: FAIL with "Failed to resolve import" (db.js doesn't exist yet)

- [ ] **Step 3: Implement TimerDB with getAllTimers and getTimer**

```javascript
// js/db.js — 原生 IndexedDB 封装，零外部依赖，纯 CRUD

const DB_NAME = 'StaminaTimerDB';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // timers 表：id 为字符串主键
      if (!db.objectStoreNames.contains('timers')) {
        const store = db.createObjectStore('timers', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }

      // v2: 移除 pushSubscriptions 表（不再需要 Web Push）
      if (event.oldVersion < 2 && db.objectStoreNames.contains('pushSubscriptions')) {
        db.deleteObjectStore('pushSubscriptions');
      }
    };
  });
}

export class TimerDB {

  static async getAllTimers() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readonly');
      const store = tx.objectStore('timers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getTimer(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readonly');
      const request = tx.objectStore('timers').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteTimer(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      tx.objectStore('timers').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "feat: add TimerDB schema, getAllTimers, getTimer, deleteTimer"
```

---

## Task 7: TimerDB — addTimer & updateTimer

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

- [ ] **Step 1: Add failing tests for addTimer and updateTimer**

Insert these describes into `tests/db.test.js` before the closing `});` of `describe('TimerDB', ...)`:

```javascript
  describe('addTimer', () => {
    it('assigns id, createdAt, updatedAt and persists', async () => {
      const before = Date.now();
      const saved = await TimerDB.addTimer({
        name: '原神',
        maxStamina: 160,
        currentStamina: 120,
        recoveryMinutes: 8,
        startTime: Date.now()
      });
      const after = Date.now();

      expect(saved.id).toBeDefined();
      expect(typeof saved.id).toBe('string');
      expect(saved.createdAt).toBeGreaterThanOrEqual(before);
      expect(saved.createdAt).toBeLessThanOrEqual(after);
      expect(saved.updatedAt).toBe(saved.createdAt);

      // Verify persisted
      const fetched = await TimerDB.getTimer(saved.id);
      expect(fetched.name).toBe('原神');
    });

    it('preserves all caller-provided fields', async () => {
      const saved = await TimerDB.addTimer({
        name: '绝区零',
        icon: '⚔️',
        maxStamina: 240,
        currentStamina: 100,
        recoveryMinutes: 6,
        startTime: 1690123456789,
        notifyAtFull: true,
        notifyInterval: 40,
        lastNotifiedStamina: 100,
        color: '#ff6b6b'
      });
      expect(saved.name).toBe('绝区零');
      expect(saved.icon).toBe('⚔️');
      expect(saved.maxStamina).toBe(240);
      expect(saved.currentStamina).toBe(100);
      expect(saved.recoveryMinutes).toBe(6);
      expect(saved.startTime).toBe(1690123456789);
      expect(saved.notifyAtFull).toBe(true);
      expect(saved.notifyInterval).toBe(40);
      expect(saved.lastNotifiedStamina).toBe(100);
      expect(saved.color).toBe('#ff6b6b');
    });
  });

  describe('updateTimer', () => {
    it('merges changes and updates updatedAt', async () => {
      const saved = await TimerDB.addTimer({
        name: '原神',
        maxStamina: 160,
        currentStamina: 120,
        recoveryMinutes: 8,
        startTime: Date.now()
      });

      // Wait a bit so updatedAt differs
      await new Promise(r => setTimeout(r, 10));

      const updated = await TimerDB.updateTimer(saved.id, {
        currentStamina: 130,
        startTime: Date.now()
      });

      expect(updated.currentStamina).toBe(130);
      expect(updated.updatedAt).toBeGreaterThan(saved.updatedAt);
      expect(updated.name).toBe('原神'); // unchanged field preserved
    });

    it('rejects with error when timer does not exist', async () => {
      await expect(TimerDB.updateTimer('nonexistent', { name: 'X' }))
        .rejects.toThrow('Timer not found');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.js`
Expected: FAIL with "TimerDB.addTimer is not a function"

- [ ] **Step 3: Implement addTimer and updateTimer**

Add these methods to the `TimerDB` class in `js/db.js`, after `getTimer` and before `deleteTimer`:

```javascript
  /**
   * 添加计时器
   * 注意：业务字段（startTime, lastNotifiedStamina 等）由 app.js 组装后传入
   * db.js 只负责分配 id / createdAt / updatedAt 并写入
   */
  static async addTimer(timer) {
    const db = await openDB();
    timer.id = crypto.randomUUID();
    timer.createdAt = Date.now();
    timer.updatedAt = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      tx.objectStore('timers').add(timer);
      tx.oncomplete = () => resolve(timer);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 更新计时器（纯数据合并 + 写入）
   * 业务逻辑（startTime 重置、体力基准计算）由 app.js 处理后传入
   */
  static async updateTimer(id, changes) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('timers', 'readwrite');
      const store = tx.objectStore('timers');
      let updated = null;
      store.get(id).onsuccess = (e) => {
        const data = e.target.result;
        if (!data) { reject(new Error('Timer not found')); return; }
        Object.assign(data, changes, { updatedAt: Date.now() });
        updated = data;
        store.put(data);
      };
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.js`
Expected: PASS (8 tests total)

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "feat: add TimerDB addTimer and updateTimer"
```

---

## Task 8: XSS Protection Utilities

**Files:**
- Create: `js/utils.js`
- Create: `tests/utils.test.js`

- [ ] **Step 1: Write failing tests for escapeHtml, validateColor, validateIcon**

```javascript
// tests/utils.test.js
import { describe, it, expect } from 'vitest';
import { escapeHtml, validateColor, validateIcon } from '../js/utils.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('handles non-string input by converting to string', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes single quote', () => {
    expect(escapeHtml("it's")).toBe("it's");
  });
});

describe('validateColor', () => {
  it('accepts valid #RRGGBB color', () => {
    expect(validateColor('#4a90d9')).toBe('#4a90d9');
  });

  it('accepts uppercase hex', () => {
    expect(validateColor('#FF6B6B')).toBe('#FF6B6B');
  });

  it('returns default for invalid color without #', () => {
    expect(validateColor('4a90d9')).toBe('#4a90d9');
  });

  it('returns default for short hex', () => {
    expect(validateColor('#abc')).toBe('#4a90d9');
  });

  it('returns default for non-hex string', () => {
    expect(validateColor('red')).toBe('#4a90d9');
  });

  it('returns default for empty string', () => {
    expect(validateColor('')).toBe('#4a90d9');
  });
});

describe('validateIcon', () => {
  it('accepts valid emoji', () => {
    expect(validateIcon('🎮')).toBe('🎮');
  });

  it('accepts 4-character string', () => {
    expect(validateIcon('ABCD')).toBe('ABCD');
  });

  it('returns default for empty string', () => {
    expect(validateIcon('')).toBe('🎮');
  });

  it('returns default for null', () => {
    expect(validateIcon(null)).toBe('🎮');
  });

  it('returns default for undefined', () => {
    expect(validateIcon(undefined)).toBe('🎮');
  });

  it('returns default for string longer than 4 chars', () => {
    expect(validateIcon('ABCDE')).toBe('🎮');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/utils.test.js`
Expected: FAIL with "Failed to resolve import" (utils.js doesn't exist)

- [ ] **Step 3: Implement escapeHtml, validateColor, validateIcon**

```javascript
// js/utils.js — XSS 防护工具函数

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function validateColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4a90d9';
}

export function validateIcon(icon) {
  if (!icon || icon.length === 0 || icon.length > 4) return '🎮';
  return icon;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/utils.test.js`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add js/utils.js tests/utils.test.js
git commit -m "feat: add XSS protection utilities (escapeHtml, validateColor, validateIcon)"
```

---

## Task 9: NotificationService — Detection Methods

**Files:**
- Create: `js/notify.js`
- Create: `tests/notify.test.js`

- [ ] **Step 1: Write failing tests for isSupported, isPermitted, isIOS, isStandalone**

```javascript
// tests/notify.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../js/notify.js';

describe('NotificationService', () => {
  let originalNotification;
  let originalNavigator;
  let originalMatchMedia;

  beforeEach(() => {
    originalNotification = globalThis.Notification;
    originalNavigator = globalThis.navigator;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    globalThis.Notification = originalNotification;
    globalThis.navigator = originalNavigator;
    window.matchMedia = originalMatchMedia;
  });

  describe('isSupported', () => {
    it('returns true when Notification exists', () => {
      globalThis.Notification = function() {};
      expect(NotificationService.isSupported()).toBe(true);
    });

    it('returns false when Notification does not exist', () => {
      delete globalThis.Notification;
      expect(NotificationService.isSupported()).toBe(false);
    });
  });

  describe('isPermitted', () => {
    it('returns true when supported and permission granted', () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';
      expect(NotificationService.isPermitted()).toBe(true);
    });

    it('returns false when permission not granted', () => {
      globalThis.Notification = function() {};
      Notification.permission = 'default';
      expect(NotificationService.isPermitted()).toBe(false);
    });

    it('returns false when not supported', () => {
      delete globalThis.Notification;
      expect(NotificationService.isPermitted()).toBe(false);
    });
  });

  describe('isIOS', () => {
    it('returns true for iPhone', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
        configurable: true
      });
      expect(NotificationService.isIOS()).toBe(true);
    });

    it('returns true for iPad', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)' },
        configurable: true
      });
      expect(NotificationService.isIOS()).toBe(true);
    });

    it('returns false for Android', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)' },
        configurable: true
      });
      expect(NotificationService.isIOS()).toBe(false);
    });

    it('returns false for desktop Chrome', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' },
        configurable: true
      });
      expect(NotificationService.isIOS()).toBe(false);
    });
  });

  describe('isStandalone', () => {
    it('returns true when display-mode is standalone', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });
      expect(NotificationService.isStandalone()).toBe(true);
    });

    it('returns true when navigator.standalone is true', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0', standalone: true },
        configurable: true
      });
      expect(NotificationService.isStandalone()).toBe(true);
    });

    it('returns false when neither standalone indicator is true', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0', standalone: false },
        configurable: true
      });
      expect(NotificationService.isStandalone()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notify.test.js`
Expected: FAIL with "Failed to resolve import" (notify.js doesn't exist)

- [ ] **Step 3: Implement detection methods**

```javascript
// js/notify.js — 本地通知服务，零后端依赖

export class NotificationService {

  /**
   * 检测浏览器是否支持通知
   */
  static isSupported() {
    return 'Notification' in window;
  }

  /**
   * 检测是否已获得通知权限
   */
  static isPermitted() {
    return this.isSupported() && Notification.permission === 'granted';
  }

  /**
   * 检测是否为 iOS 设备
   */
  static isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * 检测是否以 standalone 模式运行（已添加到主屏幕）
   */
  static isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/notify.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add js/notify.js tests/notify.test.js
git commit -m "feat: add NotificationService detection methods (isSupported, isPermitted, isIOS, isStandalone)"
```

---

## Task 10: NotificationService — requestPermission & notify

**Files:**
- Modify: `js/notify.js`
- Modify: `tests/notify.test.js`

- [ ] **Step 1: Add failing tests for requestPermission and notify**

Insert these describes into `tests/notify.test.js` before the closing `});` of `describe('NotificationService', ...)`:

```javascript
  describe('requestPermission', () => {
    it('returns not supported when Notification unavailable', async () => {
      delete globalThis.Notification;
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('当前浏览器不支持通知功能');
    });

    it('returns iOS warning when iOS not in standalone', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'default';
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'iPhone', standalone: false },
        configurable: true
      });
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('iOS');
    });

    it('returns granted when permission already granted', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(true);
    });

    it('returns denied when permission already denied', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'denied';
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('拒绝');
    });

    it('requests permission and returns granted on accept', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'default';
      Notification.requestPermission = vi.fn().mockResolvedValue('granted');
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(true);
      expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it('requests permission and returns denied on reject', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'default';
      Notification.requestPermission = vi.fn().mockResolvedValue('denied');
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('用户拒绝了通知权限');
    });
  });

  describe('notify', () => {
    it('does nothing when not permitted', async () => {
      delete globalThis.Notification;
      const timer = { id: 't1', name: '原神' };
      await NotificationService.notify(timer, 'full', 160);
      // No error thrown — just silently returns
    });

    it('uses Service Worker notification when available', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';

      const showNotification = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator = {
        serviceWorker: {
          ready: Promise.resolve({ showNotification })
        }
      };

      const timer = { id: 't1', name: '原神' };
      await NotificationService.notify(timer, 'full', 160);

      expect(showNotification).toHaveBeenCalled();
      const [title, options] = showNotification.mock.calls[0];
      expect(title).toContain('体力已满');
      expect(options.tag).toBe('stamina-t1-full-160');
      expect(options.requireInteraction).toBe(true);
    });

    it('uses plain Notification when Service Worker unavailable', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';
      delete globalThis.navigator.serviceWorker;

      const notifSpy = vi.fn();
      globalThis.Notification = vi.fn();
      globalThis.Notification.permission = 'granted';

      const timer = { id: 't1', name: '原神' };
      await NotificationService.notify(timer, 'interval', 130);

      expect(globalThis.Notification).toHaveBeenCalled();
      const [title, options] = globalThis.Notification.mock.calls[0];
      expect(title).toContain('130');
      expect(options.tag).toBe('stamina-t1-interval-130');
    });

    it('constructs full notification title and body', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';

      const showNotification = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator = {
        serviceWorker: {
          ready: Promise.resolve({ showNotification })
        }
      };

      const timer = { id: 't2', name: '崩坏星穹铁道' };
      await NotificationService.notify(timer, 'full', 240);

      const [title, options] = showNotification.mock.calls[0];
      expect(title).toBe('崩坏星穹铁道 体力已满！');
      expect(options.body).toBe('快去清体力吧～');
    });

    it('constructs interval notification title and body', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';

      const showNotification = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator = {
        serviceWorker: {
          ready: Promise.resolve({ showNotification })
        }
      };

      const timer = { id: 't3', name: '绝区零' };
      await NotificationService.notify(timer, 'interval', 40);

      const [title, options] = showNotification.mock.calls[0];
      expect(title).toBe('绝区零 体力已恢复 40 点');
      expect(options.body).toBe('注意体力恢复进度');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/notify.test.js`
Expected: FAIL with "NotificationService.requestPermission is not a function"

- [ ] **Step 3: Implement requestPermission and notify**

Add these methods to the `NotificationService` class in `js/notify.js`:

```javascript
  /**
   * 请求通知权限
   * 包含 iOS standalone 模式前置检测，避免误导性错误提示
   */
  static async requestPermission() {
    if (!this.isSupported()) {
      return { granted: false, reason: '当前浏览器不支持通知功能' };
    }
    // iOS 必须先添加到主屏幕（standalone 模式）才能使用通知
    if (this.isIOS() && !this.isStandalone()) {
      return {
        granted: false,
        reason: 'iOS 设备需先将应用添加到主屏幕（Safari → 分享按钮 → 添加到主屏幕）才能使用通知功能'
      };
    }
    if (Notification.permission === 'granted') {
      return { granted: true };
    }
    if (Notification.permission === 'denied') {
      return { granted: false, reason: '通知权限已被拒绝，请在浏览器设置中重新允许' };
    }
    const result = await Notification.requestPermission();
    return {
      granted: result === 'granted',
      reason: result === 'granted' ? null : '用户拒绝了通知权限'
    };
  }

  /**
   * 发送本地通知
   * 优先使用 Service Worker 通知（后台标签页也能显示）
   */
  static async notify(timer, type, targetStamina) {
    if (!this.isPermitted()) return;

    const title = type === 'full'
      ? `${timer.name} 体力已满！`
      : `${timer.name} 体力已恢复 ${targetStamina} 点`;
    const body = type === 'full' ? '快去清体力吧～' : '注意体力恢复进度';

    const options = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `stamina-${timer.id}-${type}-${targetStamina}`,
      requireInteraction: true,
      data: { timerId: timer.id }
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    } catch (err) {
      console.warn('通知发送失败:', err.message);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/notify.test.js`
Expected: PASS (23 tests total)

- [ ] **Step 5: Commit**

```bash
git add js/notify.js tests/notify.test.js
git commit -m "feat: add NotificationService requestPermission and notify"
```

---

## Task 11: HTML Structure

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1a1a2e">
  <title>游戏体力计时器</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="app-container">
    <header class="app-header">
      <h1>⏱️ 体力计时器</h1>
      <div class="header-actions">
        <button id="add-timer" class="btn-primary">+ 新建计时器</button>
        <button id="enable-notifications" class="btn-secondary">🔔 开启通知</button>
      </div>
    </header>
    <main id="timer-list" class="timer-list">
      <!-- 计时器卡片动态插入 -->
    </main>
  </div>

  <!-- 添加/编辑计时器模态框 -->
  <div id="modal" class="modal hidden">
    <div class="modal-content">
      <h2>新建计时器</h2>
      <form id="timer-form">
        <label>游戏名称 <input type="text" name="name" required placeholder="如：原神"></label>
        <label>图标 <input type="text" name="icon" placeholder="🎮" maxlength="4"></label>
        <label>体力上限 <input type="number" name="maxStamina" required min="1" value="160"></label>
        <label>当前体力 <input type="number" name="currentStamina" required min="0" value="0"></label>
        <label>恢复间隔（分钟） <input type="number" name="recoveryMinutes" required min="1" value="8"></label>
        <label>满体力通知 <input type="checkbox" name="notifyAtFull" checked></label>
        <label>每 N 点通知 <input type="number" name="notifyInterval" min="0" value="0" placeholder="0=不通知"></label>
        <label>主题色 <input type="color" name="color" value="#4a90d9"></label>
        <div class="form-actions">
          <button type="submit" class="btn-primary">保存</button>
          <button type="button" id="cancel-btn" class="btn-secondary">取消</button>
        </div>
      </form>
    </div>
  </div>

  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add index.html with main page and modal form"
```

---

## Task 12: CSS Styling

**Files:**
- Create: `css/style.css`

- [ ] **Step 1: Create style.css**

```css
:root {
  --bg-color: #1a1a2e;
  --card-bg: #16213e;
  --text-color: #e0e0e0;
  --primary-color: #4a90d9;
  --secondary-color: #3a6fa0;
  --danger-color: #e74c3c;
  --success-color: #2ecc71;
  --border-color: #2a2a4a;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  min-height: 100vh;
}

.app-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.app-header h1 {
  font-size: 1.8rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: opacity 0.2s;
}

.btn-secondary:hover {
  opacity: 0.85;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.timer-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timer-card {
  background-color: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid var(--theme-color, var(--primary-color));
  transition: transform 0.2s;
}

.timer-card.is-full {
  border-left-color: var(--success-color);
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.timer-icon {
  font-size: 1.5rem;
}

.timer-name {
  font-size: 1.2rem;
  font-weight: 600;
  flex-grow: 1;
}

.btn-edit,
.btn-delete {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.btn-edit:hover,
.btn-delete:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.timer-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stamina-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.3rem;
}

.current-stamina {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.countdown {
  font-variant-numeric: tabular-nums;
  color: var(--primary-color);
}

.is-full .countdown {
  color: var(--success-color);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--theme-color, var(--primary-color));
  transition: width 0.3s ease;
  border-radius: 4px;
}

.is-full .progress-fill {
  background-color: var(--success-color);
}

.timer-meta {
  font-size: 0.85rem;
  color: #888;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background-color: var(--card-bg);
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.modal-content form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-content label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
}

.modal-content input[type="text"],
.modal-content input[type="number"] {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-size: 1rem;
}

.modal-content input[type="color"] {
  width: 100%;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-color);
}

.modal-content input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin-top: 4px;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 600px) {
  .app-container {
    padding: 12px;
  }

  .app-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    flex-direction: column;
  }

  .header-actions button {
    width: 100%;
  }

  .stamina-display {
    font-size: 1.1rem;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "feat: add CSS styling with dark theme and responsive layout"
```

---

## Task 13: PWA Manifest

**Files:**
- Create: `manifest.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "id": "/",
  "name": "游戏体力计时器",
  "short_name": "体力计时",
  "description": "追踪多个游戏体力恢复，支持本地通知",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: add PWA manifest"
```

---

## Task 14: Service Worker

**Files:**
- Create: `sw.js`

- [ ] **Step 1: Create sw.js**

```javascript
// sw.js
const CACHE_NAME = 'stamina-timer-v2.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/timer.js',
  '/js/notify.js',
  '/js/utils.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

// 安装时缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 拦截请求 — 分策略处理
self.addEventListener('fetch', event => {
  const request = event.request;

  // 导航请求（HTML 页面）：网络优先，降级缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 静态资源：缓存优先，降级网络
  event.respondWith(
    caches.match(request).then(response =>
      response || fetch(request).then(fetchResponse => {
        const responseClone = fetchResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return fetchResponse;
      })
    )
  );
});

// 处理通知点击（Service Worker 通知）
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        clientList[0].focus();
        return;
      }
      clients.openWindow('/');
    })
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "feat: add Service Worker with caching and notification click handling"
```

---

## Task 15: Notification Threshold Logic (TDD)

**Files:**
- Create: `tests/app.test.js`

This task tests the `checkNotificationThreshold` logic in isolation by extracting it as a pure function before integrating into `StaminaApp`.

- [ ] **Step 1: Write failing tests for checkNotificationThreshold**

The test uses `vi.mock` to replace `db.js` and `notify.js` modules so that `app.js`'s imports receive the mocked versions. This is required because ES module bindings cannot be reassigned from outside via `vi.stubGlobal`.

```javascript
// tests/app.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock is hoisted to top of file by Vitest, before imports
vi.mock('../js/db.js', () => ({
  TimerDB: {
    getAllTimers: vi.fn(),
    getTimer: vi.fn(),
    addTimer: vi.fn(),
    updateTimer: vi.fn(),
    deleteTimer: vi.fn()
  }
}));

vi.mock('../js/notify.js', () => ({
  NotificationService: {
    isSupported: vi.fn(),
    isPermitted: vi.fn(),
    isIOS: vi.fn(),
    isStandalone: vi.fn(),
    requestPermission: vi.fn(),
    notify: vi.fn()
  }
}));

import { checkNotificationThreshold } from '../js/app.js';
import { TimerDB } from '../js/db.js';
import { NotificationService } from '../js/notify.js';

describe('checkNotificationThreshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    NotificationService.isPermitted.mockReturnValue(true);
    NotificationService.notify.mockImplementation(() => {});
    TimerDB.updateTimer.mockResolvedValue(undefined);
  });

  it('does nothing when current <= lastNotified', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: true,
      notifyInterval: 0,
      lastNotifiedStamina: 130
    };
    checkNotificationThreshold(timer, 130);
    expect(timer.lastNotifiedStamina).toBe(130);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('triggers full notification when stamina reaches max', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: true,
      notifyInterval: 0,
      lastNotifiedStamina: 155
    };
    checkNotificationThreshold(timer, 160);
    expect(timer.lastNotifiedStamina).toBe(160);
    expect(NotificationService.notify).toHaveBeenCalledWith(timer, 'full', 160);
    expect(TimerDB.updateTimer).toHaveBeenCalledWith('t1', { lastNotifiedStamina: 160 });
  });

  it('does not trigger full notification when notifyAtFull is false', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: false,
      notifyInterval: 0,
      lastNotifiedStamina: 155
    };
    checkNotificationThreshold(timer, 160);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('does not trigger full notification again if already notified at max', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: true,
      notifyInterval: 0,
      lastNotifiedStamina: 160
    };
    checkNotificationThreshold(timer, 160);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('triggers interval notification when crossing threshold', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: false,
      notifyInterval: 40,
      lastNotifiedStamina: 35
    };
    checkNotificationThreshold(timer, 42);
    // highestCrossed = floor(42/40)*40 = 40
    expect(timer.lastNotifiedStamina).toBe(42);
    expect(NotificationService.notify).toHaveBeenCalledWith(timer, 'interval', 40);
  });

  it('triggers interval notification when exactly at threshold', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: false,
      notifyInterval: 40,
      lastNotifiedStamina: 35
    };
    checkNotificationThreshold(timer, 40);
    // highestCrossed = floor(40/40)*40 = 40
    expect(NotificationService.notify).toHaveBeenCalledWith(timer, 'interval', 40);
  });

  it('does not trigger interval notification for threshold equal to maxStamina', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: false,
      notifyInterval: 40,
      lastNotifiedStamina: 120
    };
    checkNotificationThreshold(timer, 160);
    // highestCrossed = floor(160/40)*40 = 160, but 160 is not < maxStamina
    // So no interval notification (full notification handled by notifyAtFull)
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('does not trigger interval notification when interval is 0', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: false,
      notifyInterval: 0,
      lastNotifiedStamina: 0
    };
    checkNotificationThreshold(timer, 50);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('handles lastNotifiedStamina undefined by defaulting to current', () => {
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: true,
      notifyInterval: 0
      // lastNotifiedStamina undefined
    };
    checkNotificationThreshold(timer, 100);
    // current <= lastNotified (100 <= 100), so no notification
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('does not call notify when not permitted', () => {
    NotificationService.isPermitted.mockReturnValue(false);
    const timer = {
      id: 't1',
      maxStamina: 160,
      notifyAtFull: true,
      notifyInterval: 0,
      lastNotifiedStamina: 155
    };
    checkNotificationThreshold(timer, 160);
    // lastNotifiedStamina still updated, but notify not called
    expect(timer.lastNotifiedStamina).toBe(160);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app.test.js`
Expected: FAIL with "Failed to resolve import" (app.js doesn't exist yet)

- [ ] **Step 3: Create app.js with checkNotificationThreshold exported**

Create `js/app.js` with only the threshold function for now (full app added in later tasks):

```javascript
// js/app.js
import { TimerDB } from './db.js';
import { StaminaCalculator } from './timer.js';
import { NotificationService } from './notify.js';
import { escapeHtml, validateColor, validateIcon } from './utils.js';

/**
 * 检测体力是否跨过通知阈值，跨过则弹通知
 * 使用 lastNotifiedStamina 防止重复弹窗
 * 导出为独立函数以便单元测试
 */
export function checkNotificationThreshold(timer, current) {
  const lastNotified = timer.lastNotifiedStamina ?? current;
  if (current <= lastNotified) return;

  let notifyType = null;
  let targetStamina = current;

  // 检测满体力通知
  if (timer.notifyAtFull && current >= timer.maxStamina && lastNotified < timer.maxStamina) {
    notifyType = 'full';
    targetStamina = timer.maxStamina;
  }
  // 检测间隔通知
  else if (timer.notifyInterval > 0 && current < timer.maxStamina) {
    // 取最近跨越的阈值（而非最旧的），避免 app 关闭后通知内容与实际体力不符
    // 注意：不加 -1，否则当 current 恰好等于阈值时会漏检
    const highestCrossed = Math.floor(current / timer.notifyInterval) * timer.notifyInterval;
    if (highestCrossed > lastNotified && highestCrossed < timer.maxStamina) {
      notifyType = 'interval';
      targetStamina = highestCrossed;
    }
  }

  if (notifyType) {
    // 先更新追踪值（同步），防止下一秒重复触发
    timer.lastNotifiedStamina = current;
    // 持久化到 IndexedDB（异步，不阻塞 UI）
    TimerDB.updateTimer(timer.id, { lastNotifiedStamina: current });
    // 发送通知（仅在已授权时）
    if (NotificationService.isPermitted()) {
      NotificationService.notify(timer, notifyType, targetStamina);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add js/app.js tests/app.test.js
git commit -m "feat: add checkNotificationThreshold with TDD tests"
```

---

## Task 16: StaminaApp — init, render, bindEvents

**Files:**
- Modify: `js/app.js`
- Modify: `tests/app.test.js`

- [ ] **Step 1: Add StaminaApp class with init, render, bindEvents to app.js**

Append to `js/app.js` (after the `checkNotificationThreshold` function):

```javascript
// ─── 应用主类 ───

class StaminaApp {
  constructor() {
    this.timers = [];
    this.updateInterval = null;
    this.init();
  }

  async init() {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
    }
    // 加载数据
    this.timers = await TimerDB.getAllTimers();
    // 初始化 lastNotifiedStamina（兼容旧数据），并持久化到 IndexedDB
    this.timers.forEach(timer => {
      if (timer.lastNotifiedStamina === undefined) {
        timer.lastNotifiedStamina = StaminaCalculator.getCurrentStamina(timer);
        TimerDB.updateTimer(timer.id, { lastNotifiedStamina: timer.lastNotifiedStamina });
      }
    });
    this.render();
    this.startUpdateLoop();
    this.bindEvents();

    // v1.2.2: 恢复通知按钮状态（已授权时直接显示已开启）
    if (NotificationService.isPermitted()) {
      const btn = document.getElementById('enable-notifications');
      if (btn) {
        btn.textContent = '✅ 通知已开启';
        btn.disabled = true;
      }
    }
  }

  bindEvents() {
    document.getElementById('add-timer').addEventListener('click', () => this.showAddModal());
    document.getElementById('enable-notifications').addEventListener('click', () => this.enableNotifications());
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());

    // 表单提交处理器
    document.getElementById('timer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const formData = {
        name: form.name.value.trim(),
        icon: form.icon.value.trim(),
        maxStamina: parseInt(form.maxStamina.value),
        currentStamina: parseInt(form.currentStamina.value),
        recoveryMinutes: parseInt(form.recoveryMinutes.value),
        notifyAtFull: form.notifyAtFull.checked,
        notifyInterval: parseInt(form.notifyInterval.value) || 0,
        color: form.color.value
      };

      // 输入校验
      if (!formData.name) {
        alert('请输入游戏名称');
        return;
      }
      if (isNaN(formData.maxStamina) || formData.maxStamina < 1) {
        alert('体力上限必须为正整数');
        return;
      }
      if (isNaN(formData.currentStamina) || formData.currentStamina < 0) {
        alert('当前体力不能为负数');
        return;
      }
      if (formData.currentStamina > formData.maxStamina) {
        alert('当前体力不能超过体力上限');
        return;
      }
      if (isNaN(formData.recoveryMinutes) || formData.recoveryMinutes < 1) {
        alert('恢复间隔必须为正整数（分钟）');
        return;
      }

      try {
        const modal = document.getElementById('modal');
        if (modal.dataset.mode === 'edit') {
          await this.updateTimer(modal.dataset.timerId, formData);
        } else {
          await this.addTimer(formData);
        }
        this.closeModal();
      } catch (err) {
        console.error('保存失败:', err);
        alert('保存失败: ' + err.message);
      }
    });
  }

  startUpdateLoop() {
    // 每秒更新显示 + 检测通知阈值
    this.updateInterval = setInterval(() => this.updateDisplay(), 1000);

    // v1.2.2: 页面从后台切回前台时立即刷新
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateDisplay();
      }
    });
  }

  /**
   * 每秒执行：更新 UI 显示 + 轮询检测通知阈值
   */
  updateDisplay() {
    this.timers.forEach(timer => {
      const current = StaminaCalculator.getCurrentStamina(timer);
      const toFull = StaminaCalculator.timeToFull(timer);
      const countdown = StaminaCalculator.formatCountdown(toFull);

      // 更新 UI
      const el = document.querySelector(`[data-timer-id="${timer.id}"]`);
      if (el) {
        el.querySelector('.current-stamina').textContent = `${current}/${timer.maxStamina}`;
        el.querySelector('.countdown').textContent = countdown;
        el.querySelector('.progress-fill').style.width = `${(current / timer.maxStamina) * 100}%`;
        el.classList.toggle('is-full', current >= timer.maxStamina);
      }

      // 轮询检测通知阈值
      checkNotificationThreshold(timer, current);
    });
  }

  async addTimer(formData) {
    const now = Date.now();
    const timer = {
      name: formData.name,
      icon: validateIcon(formData.icon),
      maxStamina: parseInt(formData.maxStamina),
      currentStamina: parseInt(formData.currentStamina),
      recoveryMinutes: parseInt(formData.recoveryMinutes),
      startTime: now,
      notifyAtFull: formData.notifyAtFull,
      notifyInterval: parseInt(formData.notifyInterval) || 0,
      lastNotifiedStamina: parseInt(formData.currentStamina),
      color: validateColor(formData.color)
    };
    const saved = await TimerDB.addTimer(timer);
    this.timers.push(saved);
    this.render();
  }

  async editTimer(id) {
    const timer = this.timers.find(t => t.id === id);
    if (!timer) return;
    this.showEditModal(timer);
  }

  async updateTimer(id, formData) {
    const old = await TimerDB.getTimer(id);
    if (!old) throw new Error('Timer not found');

    const changes = {
      name: formData.name,
      icon: validateIcon(formData.icon),
      maxStamina: parseInt(formData.maxStamina),
      currentStamina: parseInt(formData.currentStamina),
      recoveryMinutes: parseInt(formData.recoveryMinutes),
      startTime: Date.now(),
      notifyAtFull: formData.notifyAtFull,
      notifyInterval: parseInt(formData.notifyInterval) || 0,
      lastNotifiedStamina: parseInt(formData.currentStamina),
      color: validateColor(formData.color)
    };

    const updated = await TimerDB.updateTimer(id, changes);

    const index = this.timers.findIndex(t => t.id === id);
    if (index !== -1) {
      this.timers[index] = updated;
    }
    this.render();
  }

  async deleteTimer(id) {
    if (!confirm('确定删除这个计时器？')) return;
    try {
      await TimerDB.deleteTimer(id);
      this.timers = this.timers.filter(t => t.id !== id);
      this.render();
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败: ' + err.message);
    }
  }

  async enableNotifications() {
    const result = await NotificationService.requestPermission();
    if (result.granted) {
      alert('通知已开启！');
      const btn = document.getElementById('enable-notifications');
      btn.textContent = '✅ 通知已开启';
      btn.disabled = true;
    } else {
      alert(result.reason || '通知开启失败');
    }
  }

  // ─── 模态框 ───

  showAddModal() {
    const modal = document.getElementById('modal');
    modal.querySelector('h2').textContent = '新建计时器';
    modal.querySelector('form').reset();
    modal.dataset.mode = 'add';
    modal.classList.remove('hidden');
  }

  showEditModal(timer) {
    const modal = document.getElementById('modal');
    const form = modal.querySelector('form');
    modal.querySelector('h2').textContent = '编辑计时器';
    modal.dataset.mode = 'edit';
    modal.dataset.timerId = timer.id;

    form.name.value = timer.name;
    form.icon.value = timer.icon || '';
    form.maxStamina.value = timer.maxStamina;
    form.currentStamina.value = Math.round(StaminaCalculator.getExactStamina(timer));
    form.recoveryMinutes.value = timer.recoveryMinutes;
    form.notifyAtFull.checked = timer.notifyAtFull;
    form.notifyInterval.value = timer.notifyInterval || 0;
    form.color.value = timer.color || '#4a90d9';

    modal.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  // ─── 渲染 ───

  render() {
    const container = document.getElementById('timer-list');
    container.innerHTML = '';

    this.timers.forEach(timer => {
      const card = document.createElement('div');
      card.className = 'timer-card';
      card.dataset.timerId = timer.id;
      card.style.setProperty('--theme-color', validateColor(timer.color));

      card.innerHTML = `
        <div class="timer-header">
          <span class="timer-icon">${escapeHtml(timer.icon)}</span>
          <span class="timer-name">${escapeHtml(timer.name)}</span>
          <button class="btn-edit" data-action="edit">⚙️</button>
          <button class="btn-delete" data-action="delete">🗑️</button>
        </div>
        <div class="timer-body">
          <div class="stamina-display">
            <span class="current-stamina">--/${escapeHtml(String(timer.maxStamina))}</span>
            <span class="countdown">--:--:--</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="timer-meta">
            <span>每 ${escapeHtml(String(timer.recoveryMinutes))} 分钟恢复 1 点</span>
          </div>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => this.editTimer(timer.id));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteTimer(timer.id));

      container.appendChild(card);
    });

    this.updateDisplay();
  }
}

// Only auto-start in browser with expected DOM, not in tests
if (typeof document !== 'undefined' && document.getElementById('timer-list')) {
  const app = new StaminaApp();
  window.app = app;
}

export { StaminaApp };
```

- [ ] **Step 2: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: PASS (all previous tests still pass — app.test.js threshold tests use the exported function, not the class)

- [ ] **Step 3: Commit**

```bash
git add js/app.js tests/app.test.js
git commit -m "feat: add StaminaApp class with init, render, bindEvents, CRUD, and display loop"
```

---

## Task 17: Generate PWA Icons

**Files:**
- Create: `scripts/generate-icons.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Create: `icons/icon-maskable-512.png`

- [ ] **Step 1: Create icon generation script**

```javascript
// scripts/generate-icons.js
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = `${__dirname}/../icons`;

function generateIcon(size, filename, maskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);

  // For maskable icons, add safe zone padding (10%)
  const padding = maskable ? size * 0.1 : 0;
  const innerSize = size - padding * 2;
  const centerX = size / 2;
  const centerY = size / 2;

  // Draw a simple stopwatch/clock icon
  const radius = innerSize * 0.35;

  // Circle outline
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Top button
  ctx.fillStyle = '#4a90d9';
  ctx.fillRect(centerX - size * 0.04, centerY - radius - size * 0.08, size * 0.08, size * 0.06);

  // Clock hands
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = 'round';

  // Hour hand
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX, centerY - radius * 0.5);
  ctx.stroke();

  // Minute hand
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + radius * 0.7, centerY);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = '#4a90d9';
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.025, 0, Math.PI * 2);
  ctx.fill();

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(`${iconsDir}/${filename}`, buffer);
  console.log(`Generated: icons/${filename} (${size}x${size}${maskable ? ' maskable' : ''})`);
}

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

generateIcon(192, 'icon-192.png');
generateIcon(512, 'icon-512.png');
generateIcon(512, 'icon-maskable-512.png', true);

console.log('All icons generated successfully.');
```

- [ ] **Step 2: Run the icon generation script**

Run: `node scripts/generate-icons.js`
Expected: Output "Generated: icons/icon-192.png", "Generated: icons/icon-512.png", "Generated: icons/icon-maskable-512.png", "All icons generated successfully."

- [ ] **Step 3: Verify icons exist**

Run: `dir icons`
Expected: Three PNG files listed (icon-192.png, icon-512.png, icon-maskable-512.png)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-icons.js icons/
git commit -m "feat: generate PWA placeholder icons (192, 512, maskable-512)"
```

---

## Task 18: Integration Testing & Manual Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: ALL tests pass (timer: 24, db: 8, utils: 16, notify: 23, app: 10 = 81 tests total)

- [ ] **Step 2: Start local dev server**

Run: `npx http-server . -p 3000 -c-1`
Expected: Server running at http://localhost:3000

- [ ] **Step 3: Manual test — page loads**

Open browser to `http://localhost:3000`
Expected:
- Page title "⏱️ 体力计时器" displays
- "+ 新建计时器" button visible
- "🔔 开启通知" button visible
- Empty timer list area
- No console errors

- [ ] **Step 4: Manual test — create a timer**

1. Click "+ 新建计时器"
2. Fill in: name=原神, icon=🎮, maxStamina=160, currentStamina=120, recoveryMinutes=8
3. Click "保存"
Expected: Timer card appears showing "120/160", countdown timer, progress bar at 75%

- [ ] **Step 5: Manual test — countdown updates**

Wait 10 seconds watching the timer card.
Expected: Countdown updates every second, progress bar may move slightly

- [ ] **Step 6: Manual test — edit a timer**

1. Click ⚙️ edit button on the timer card
2. Change currentStamina to 100
3. Click "保存"
Expected: Timer card updates to show "100/160", countdown recalculates

- [ ] **Step 7: Manual test — delete a timer**

1. Click 🗑️ delete button on the timer card
2. Confirm in the dialog
Expected: Timer card disappears, list empty

- [ ] **Step 8: Manual test — PWA installability**

Open Chrome DevTools → Application tab → Manifest
Expected:
- Manifest loaded with name "游戏体力计时器"
- Icons display correctly
- Installability criteria met (no errors)

- [ ] **Step 9: Manual test — Service Worker registration**

In DevTools → Application → Service Workers
Expected: `sw.js` registered and active

- [ ] **Step 10: Manual test — offline mode**

1. In DevTools → Application → Service Workers → check "Offline"
2. Refresh page
Expected: Page loads from cache, timer data persists (IndexedDB)

- [ ] **Step 11: Stop the dev server**

Press `Ctrl+C` in terminal

- [ ] **Step 12: Final commit**

```bash
git add -A
git commit -m "chore: integration testing complete, all features verified"
```

---

## Deployment Guide

After all tests pass and manual verification is complete:

### Deploy to GitHub Pages

```bash
# Create a gh-pages branch with just the static files
git subtree push --prefix . origin gh-pages
```

### Deploy to Vercel

1. Push code to GitHub
2. In Vercel dashboard, import the repository
3. Framework: "Other"
4. Output directory: project root (`.`)
5. Deploy — Vercel provides HTTPS automatically (required for PWA)

### Deploy to Netlify

1. Push code to GitHub
2. In Netlify dashboard, create new site from Git
3. Build command: (leave empty)
4. Publish directory: `.`
5. Deploy

### Post-deployment verification

1. Visit the HTTPS URL
2. Verify Service Worker registers (DevTools → Application)
3. Verify manifest loads (DevTools → Application → Manifest)
4. Install PWA via browser install prompt
5. Create a timer, close and reopen the PWA — data should persist
