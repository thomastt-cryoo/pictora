import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE, hexToRgb, rgbToHex } from './color';

describe('color', () => {
  it('maps pure white and black to expected L*', () => {
    expect(rgbToLab(255, 255, 255).L).toBeCloseTo(100, 0);
    expect(rgbToLab(0, 0, 0).L).toBeCloseTo(0, 0);
  });

  it('gives zero ΔE for identical colors', () => {
    const a = rgbToLab(120, 60, 200);
    expect(deltaE(a, a)).toBe(0);
  });

  it('separates distinct colors with a large ΔE', () => {
    const red = rgbToLab(255, 0, 0);
    const green = rgbToLab(0, 255, 0);
    expect(deltaE(red, green)).toBeGreaterThan(50);
  });

  it('round-trips hex <-> rgb', () => {
    expect(hexToRgb('#3366cc')).toEqual({ r: 0x33, g: 0x66, b: 0xcc });
    expect(rgbToHex(0x33, 0x66, 0xcc)).toBe('#3366cc');
    expect(hexToRgb('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
  });
});
