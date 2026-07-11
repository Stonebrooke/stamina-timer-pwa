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
});
