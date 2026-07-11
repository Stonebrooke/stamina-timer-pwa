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
}
