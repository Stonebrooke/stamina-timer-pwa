// js/utils.js — XSS 防护工具函数

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function validateColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4a90d9';
}

export function validateIcon(icon) {
  if (!icon || icon.length === 0 || icon.length > 4) return '🎮';
  return icon;
}
