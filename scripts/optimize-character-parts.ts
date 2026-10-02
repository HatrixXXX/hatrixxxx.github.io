import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceRoot = resolve(root, 'src/assets/home/character-parts-source');
const outputRoot = resolve(root, 'public/character-parts');
const manifestPath = resolve(root, 'src/data/character-parts.ts');

type Bounds = { x: number; y: number; width: number; height: number };

function alphaBounds(data: Buffer, width: number, height: number): Bounds {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0 || maxY < 0) throw new Error('Character part is fully transparent');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main(): Promise<void> {
  const files = (await readdir(sourceRoot)).filter((file) => file.endsWith('.png')).sort();
  if (files.length !== 29) throw new Error(`Expected 29 source PNGs, found ${files.length}`);

  const parts: Record<string, { src: string } & Bounds> = {};
  for (const file of files) {
    const input = join(sourceRoot, file);
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1024 || info.height !== 1536 || info.channels !== 4) {
      throw new Error(`${file} must be a 1024x1536 RGBA image`);
    }
    const bounds = alphaBounds(data, info.width, info.height);
    const name = basename(file, '.png');
    parts[name] = { src: `/character-parts/${name}.webp`, ...bounds };
  }

  const source = `export interface CharacterPart {\n  src: string;\n  x: number;\n  y: number;\n  width: number;\n  height: number;\n}\n\nexport const CHARACTER_CANVAS = { width: 1024, height: 1536 } as const;\n\nexport const CHARACTER_PARTS = ${JSON.stringify(parts, null, 2)} as const satisfies Record<string, CharacterPart>;\n\nexport type CharacterPartName = keyof typeof CHARACTER_PARTS;\n`;
  const stagingRoot = await mkdtemp(join(root, '.character-parts-'));
  try {
    for (const file of files) {
      const name = basename(file, '.png');
      const bounds = parts[name]!;
      await sharp(join(sourceRoot, file))
        .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
        .webp({ lossless: true, effort: 6 })
        .toFile(join(stagingRoot, `${name}.webp`));
    }
    await writeFile(join(stagingRoot, 'character-parts.ts'), source, 'utf8');

    await mkdir(outputRoot, { recursive: true });
    for (const name of Object.keys(parts)) {
      await rename(join(stagingRoot, `${name}.webp`), join(outputRoot, `${name}.webp`));
    }
    await rename(join(stagingRoot, 'character-parts.ts'), manifestPath);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

void main();
