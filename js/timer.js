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
}
