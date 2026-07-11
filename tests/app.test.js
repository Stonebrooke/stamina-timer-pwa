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
