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
});
