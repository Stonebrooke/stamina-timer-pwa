// tests/utils.test.js
import { describe, it, expect } from 'vitest';
import { escapeHtml, validateColor, validateIcon } from '../js/utils.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('handles non-string input by converting to string', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes single quote', () => {
    expect(escapeHtml("it's")).toBe("it's");
  });
});

describe('validateColor', () => {
  it('accepts valid #RRGGBB color', () => {
    expect(validateColor('#4a90d9')).toBe('#4a90d9');
  });

  it('accepts uppercase hex', () => {
    expect(validateColor('#FF6B6B')).toBe('#FF6B6B');
  });

  it('returns default for invalid color without #', () => {
    expect(validateColor('4a90d9')).toBe('#4a90d9');
  });

  it('returns default for short hex', () => {
    expect(validateColor('#abc')).toBe('#4a90d9');
  });

  it('returns default for non-hex string', () => {
    expect(validateColor('red')).toBe('#4a90d9');
  });

  it('returns default for empty string', () => {
    expect(validateColor('')).toBe('#4a90d9');
  });
});

describe('validateIcon', () => {
  it('accepts valid emoji', () => {
    expect(validateIcon('🎮')).toBe('🎮');
  });

  it('accepts 4-character string', () => {
    expect(validateIcon('ABCD')).toBe('ABCD');
  });

  it('returns default for empty string', () => {
    expect(validateIcon('')).toBe('🎮');
  });

  it('returns default for null', () => {
    expect(validateIcon(null)).toBe('🎮');
  });

  it('returns default for undefined', () => {
    expect(validateIcon(undefined)).toBe('🎮');
  });

  it('returns default for string longer than 4 chars', () => {
    expect(validateIcon('ABCDE')).toBe('🎮');
  });
});
