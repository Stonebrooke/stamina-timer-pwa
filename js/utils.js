// js/utils.js — XSS 防护工具函数 + Toast 通知

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function validateColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4a90d9';
}

/**
 * 显示非阻塞 toast 通知
 * @param {string} message - 消息内容
 * @param {'info'|'error'|'success'} type - 通知类型
 * @param {number} duration - 显示时长（毫秒）
 */
export function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // 最多同时显示 3 条，超出移除最早的
  while (container.children.length >= 3) {
    container.firstChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // 入场动画
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}
