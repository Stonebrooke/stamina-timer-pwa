// tests/notify.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../js/notify.js';

// Helper: 设置 navigator 属性（jsdom 中 navigator 是只读的，必须用 defineProperty）
function setNavigatorProperty(prop, value) {
  Object.defineProperty(navigator, prop, {
    value,
    configurable: true,
    writable: true
  });
}

describe('NotificationService', () => {
  let originalNotification;
  let savedUserAgent;
  let savedStandalone;
  let savedServiceWorker;
  let originalMatchMedia;

  beforeEach(() => {
    originalNotification = globalThis.Notification;
    savedUserAgent = navigator.userAgent;
    savedStandalone = navigator.standalone;
    savedServiceWorker = navigator.serviceWorker;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    globalThis.Notification = originalNotification;
    setNavigatorProperty('userAgent', savedUserAgent);
    setNavigatorProperty('standalone', savedStandalone);
    setNavigatorProperty('serviceWorker', savedServiceWorker);
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
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)');
      expect(NotificationService.isIOS()).toBe(true);
    });

    it('returns true for iPad', () => {
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)');
      expect(NotificationService.isIOS()).toBe(true);
    });

    it('returns false for Android', () => {
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (Linux; Android 13; Pixel 7)');
      expect(NotificationService.isIOS()).toBe(false);
    });

    it('returns false for desktop Chrome', () => {
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0');
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
      setNavigatorProperty('standalone', true);
      expect(NotificationService.isStandalone()).toBe(true);
    });

    it('returns false when neither standalone indicator is true', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      setNavigatorProperty('standalone', false);
      expect(NotificationService.isStandalone()).toBe(false);
    });
  });

  describe('requestPermission', () => {
    // 确保这些测试中 isIOS 返回 false（默认 userAgent 不含 iOS 标识）
    beforeEach(() => {
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    });

    it('returns not supported when Notification unavailable', async () => {
      delete globalThis.Notification;
      const result = await NotificationService.requestPermission();
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('当前浏览器不支持通知功能');
    });

    it('returns iOS warning when iOS not in standalone', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'default';
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)');
      setNavigatorProperty('standalone', false);
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
    beforeEach(() => {
      setNavigatorProperty('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    });

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
      setNavigatorProperty('serviceWorker', {
        ready: Promise.resolve({ showNotification })
      });

      const timer = { id: 't1', name: '原神' };
      await NotificationService.notify(timer, 'full', 160);

      expect(showNotification).toHaveBeenCalled();
      const [title, options] = showNotification.mock.calls[0];
      expect(title).toContain('体力已满');
      expect(options.tag).toBe('stamina-t1-full-160');
      expect(options.requireInteraction).toBe(true);
    });

    it('uses plain Notification when Service Worker unavailable', async () => {
      const notifSpy = vi.fn();
      globalThis.Notification = notifSpy;
      Notification.permission = 'granted';
      setNavigatorProperty('serviceWorker', undefined);

      const timer = { id: 't1', name: '原神' };
      await NotificationService.notify(timer, 'interval', 130);

      expect(notifSpy).toHaveBeenCalled();
      const [title, options] = notifSpy.mock.calls[0];
      expect(title).toContain('130');
      expect(options.tag).toBe('stamina-t1-interval-130');
    });

    it('constructs full notification title and body', async () => {
      globalThis.Notification = function() {};
      Notification.permission = 'granted';

      const showNotification = vi.fn().mockResolvedValue(undefined);
      setNavigatorProperty('serviceWorker', {
        ready: Promise.resolve({ showNotification })
      });

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
      setNavigatorProperty('serviceWorker', {
        ready: Promise.resolve({ showNotification })
      });

      const timer = { id: 't3', name: '绝区零' };
      await NotificationService.notify(timer, 'interval', 40);

      const [title, options] = showNotification.mock.calls[0];
      expect(title).toBe('绝区零 体力已恢复 40 点');
      expect(options.body).toBe('注意体力恢复进度');
    });
  });
});
