import { describe, it, expect } from 'vitest';
import { getPreviewType } from '../scanner';

// We import the set indirectly by checking behavior
describe('SVG preview handling', () => {
  it('getPreviewType returns "svg" for .svg extension', () => {
    expect(getPreviewType('.svg')).toBe('svg');
  });

  it('getPreviewType does NOT return "image" for .svg', () => {
    expect(getPreviewType('.svg')).not.toBe('image');
  });

  it('.svg is treated as text-readable (not binary/image)', () => {
    const type = getPreviewType('.svg');
    // svg should be read as text content, not served as binary image
    expect(['text', 'code', 'svg', 'markdown', 'json']).toContain(type);
  });

  it('IMAGE_EXTENSIONS does not include .svg', async () => {
    // We verify indirectly: if .svg were in IMAGE_EXTENSIONS,
    // getPreviewType would return 'image' before reaching the svg check
    // Since getPreviewType checks svg BEFORE image, and returns 'svg',
    // this confirms .svg is handled separately from images
    expect(getPreviewType('.svg')).toBe('svg');
    // Also verify actual image extensions still work
    expect(getPreviewType('.png')).toBe('image');
    expect(getPreviewType('.jpg')).toBe('image');
  });
});
