import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(process.cwd());
const fixturesDir = path.join(root, 'e2e', 'fixtures');

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="240" height="180" viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="240" height="180" rx="18" fill="#0ea5e9" />
  <circle cx="72" cy="78" r="34" fill="#22c55e" />
  <rect x="120" y="42" width="70" height="70" rx="12" fill="#f59e0b" />
  <text x="120" y="154" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#ffffff">SVG TEST</text>
</svg>`;

export async function generateTestAssets() {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(path.join(fixturesDir, 'sample-svg.svg'), svgContent, 'utf8');
  await fs.writeFile(path.join(fixturesDir, 'not-an-image.txt'), 'This is intentionally not an image file.', 'utf8');

  const script = `
from PIL import Image, ImageDraw
import os
fixtures_dir = r'''${fixturesDir}'''
files = {
  'sample-jpg.jpg': ('JPEG', (220, 38, 38)),
  'sample-png.png': ('PNG', (37, 99, 235)),
  'sample-bmp.bmp': ('BMP', (234, 179, 8)),
  'sample-tiff.tiff': ('TIFF', (6, 95, 70)),
  'sample-webp.webp': ('WEBP', (126, 34, 206)),
  'sample-gif.gif': ('GIF', (190, 24, 93)),
}
for filename, (fmt, color) in files.items():
  image = Image.new('RGB', (240, 180), color)
  draw = ImageDraw.Draw(image)
  draw.rounded_rectangle((16, 16, 224, 164), radius=16, outline=(255,255,255), width=4)
  draw.text((70, 78), filename.split('.')[0].upper(), fill=(255,255,255))
  image.save(os.path.join(fixtures_dir, filename), fmt)
`;

  const result = spawnSync('python3', ['-c', script], { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to generate raster fixtures');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateTestAssets();
}
