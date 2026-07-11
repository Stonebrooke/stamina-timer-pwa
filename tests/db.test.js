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
});
