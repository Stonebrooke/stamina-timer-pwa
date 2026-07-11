// js/app.js
import { TimerDB } from './db.js';
import { StaminaCalculator } from './timer.js';
import { NotificationService } from './notify.js';
import { escapeHtml, validateColor, showToast } from './utils.js';

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

    // PWA 安装支持
    this.setupInstallPrompt();
  }

  bindEvents() {
    document.getElementById('add-timer').addEventListener('click', () => this.showAddModal());
    document.getElementById('enable-notifications').addEventListener('click', () => this.enableNotifications());
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());

    // 点击模态框外部遮罩区域关闭
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    // Escape 键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('modal').classList.contains('hidden')) {
        this.closeModal();
      }
    });

    // 表单提交处理器
    document.getElementById('timer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const formData = {
        name: form.name.value.trim(),
        maxStamina: parseInt(form.maxStamina.value),
        currentStamina: parseInt(form.currentStamina.value),
        recoveryMinutes: parseInt(form.recoveryMinutes.value),
        notifyAtFull: form.notifyAtFull.checked,
        notifyInterval: parseInt(form.notifyInterval.value) || 0,
        color: form.color.value
      };

      // 输入校验
      if (!formData.name) {
        showToast('请输入游戏名称', 'error');
        return;
      }
      if (isNaN(formData.maxStamina) || formData.maxStamina < 1) {
        showToast('体力上限必须为正整数', 'error');
        return;
      }
      if (isNaN(formData.currentStamina) || formData.currentStamina < 0) {
        showToast('当前体力不能为负数', 'error');
        return;
      }
      if (formData.currentStamina > formData.maxStamina) {
        showToast('当前体力不能超过体力上限', 'error');
        return;
      }
      if (isNaN(formData.recoveryMinutes) || formData.recoveryMinutes < 1) {
        showToast('恢复间隔必须为正整数（分钟）', 'error');
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
        showToast('保存失败: ' + err.message, 'error');
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
      showToast('计时器已删除', 'success');
    } catch (err) {
      console.error('删除失败:', err);
      showToast('删除失败: ' + err.message, 'error');
    }
  }

  async enableNotifications() {
    const result = await NotificationService.requestPermission();
    if (result.granted) {
      showToast('通知已开启！', 'success');
      const btn = document.getElementById('enable-notifications');
      btn.textContent = '✅ 通知已开启';
      btn.disabled = true;
    } else {
      showToast(result.reason || '通知开启失败', 'error');
    }
  }

  // ─── PWA 安装支持 ───

  setupInstallPrompt() {
    // 桌面端：捕获 beforeinstallprompt，显示自定义安装按钮
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('install-app');
      if (btn) btn.style.display = 'inline-block';
    });

    const installBtn = document.getElementById('install-app');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.style.display = 'none';
      });
    }

    window.addEventListener('appinstalled', () => {
      const btn = document.getElementById('install-app');
      if (btn) btn.style.display = 'none';
    });

    // iOS：非 standalone 模式 + 本会话未关闭过引导 → 显示安装引导浮层
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const guideDismissed = sessionStorage.getItem('ios-install-guide-dismissed') === '1';
    if (isIOS && !isStandalone && !guideDismissed) {
      const guide = document.getElementById('ios-install-guide');
      if (guide) guide.classList.remove('hidden');
    }

    const closeBtn = document.getElementById('close-install-guide');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('ios-install-guide').classList.add('hidden');
        sessionStorage.setItem('ios-install-guide-dismissed', '1');
      });
    }
  }

  // ─── 模态框 ───

  showAddModal() {
    this._triggerElement = document.activeElement;
    const modal = document.getElementById('modal');
    modal.querySelector('h2').textContent = '新建计时器';
    modal.querySelector('form').reset();
    modal.dataset.mode = 'add';
    modal.classList.remove('hidden');
    modal.querySelector('input[name="name"]').focus();
  }

  showEditModal(timer) {
    this._triggerElement = document.activeElement;
    const modal = document.getElementById('modal');
    const form = modal.querySelector('form');
    modal.querySelector('h2').textContent = '编辑计时器';
    modal.dataset.mode = 'edit';
    modal.dataset.timerId = timer.id;

    form.name.value = timer.name;
    form.maxStamina.value = timer.maxStamina;
    form.currentStamina.value = Math.round(StaminaCalculator.getExactStamina(timer));
    form.recoveryMinutes.value = timer.recoveryMinutes;
    form.notifyAtFull.checked = timer.notifyAtFull;
    form.notifyInterval.value = timer.notifyInterval || 0;
    form.color.value = timer.color || '#4a90d9';

    modal.classList.remove('hidden');
    form.name.focus();
  }

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
    this._triggerElement?.focus();
  }

  // ─── 渲染 ───

  render() {
    const container = document.getElementById('timer-list');
    container.innerHTML = '';

    if (this.timers.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>还没有计时器，点击「新建计时器」开始追踪吧！</p></div>';
      return; // 无计时器，无需 updateDisplay
    }

    this.timers.forEach(timer => {
      const card = document.createElement('div');
      card.className = 'timer-card';
      card.dataset.timerId = timer.id;
      card.style.setProperty('--theme-color', validateColor(timer.color));

      card.innerHTML = `
        <div class="timer-header">
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
