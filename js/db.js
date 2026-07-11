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
