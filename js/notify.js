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
      if (navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    } catch (err) {
      console.warn('通知发送失败:', err.message);
    }
  }
}
