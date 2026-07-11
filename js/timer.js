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
}
