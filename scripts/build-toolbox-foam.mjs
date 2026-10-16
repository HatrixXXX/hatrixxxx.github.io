import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import sharp from 'sharp';
import perspective from '../src/config/toolbox-perspective.json' with { type: 'json' };

// GLTFExporter uses the browser FileReader API for its binary chunks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const outputDirectory = resolve('public/assets/toolbox');
const sourceDirectory = resolve('docs/design-references/toolbox-case');
const depth = 0.78;
const modelsOnly = process.argv.includes('--models-only');
const textureOnly = process.argv.includes('--texture-only');
const haloOnly = process.argv.includes('--halo-only');
await mkdir(outputDirectory, { recursive: true });

if (!modelsOnly && !haloOnly) {
  for (const texture of [
    { source: 'insert-metal-top-v4-source.png', output: 'insert-top-detail-v5.webp', blur: 2.4, multiplier: 0.15, offset: 212 },
    { source: 'insert-slot-metal-v3-source.png', output: 'insert-slot-detail-v5.webp', blur: 2, multiplier: 0.18, offset: 202 }
  ]) {
    await sharp(resolve(sourceDirectory, texture.source))
      .extract({ left: 307, top: 307, width: 640, height: 640 })
      .resize(512, 512)
      .greyscale()
      .blur(texture.blur)
      .linear(texture.multiplier, texture.offset)
      .webp({ quality: 88, effort: 6 })
      .toFile(resolve(outputDirectory, texture.output));
  }
}

async function writeHaloMask(layout) {
  const { data, info } = await sharp(resolve(sourceDirectory, layout.source))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const silhouette = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y++) {
    let left = info.width;
    let right = -1;
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 16) {
        left = Math.min(left, x);
        right = x;
      }
    }
    for (let x = left; x <= right; x++) {
      const offset = (y * info.width + x) * 4;
      silhouette[offset] = 255;
      silhouette[offset + 1] = 255;
      silhouette[offset + 2] = 255;
      silhouette[offset + 3] = 255;
    }
  }
  await sharp(silhouette, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(...layout.assetSize)
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDirectory, layout.haloMask));
}

function cameraFor(layout) {
  const elevation = THREE.MathUtils.degToRad(layout.elevation);
  const camera = new THREE.PerspectiveCamera(
    perspective.camera.fov,
    layout.sourceSize[0] / layout.sourceSize[1],
    0.1,
    100
  );
  camera.position.set(0, Math.sin(elevation) * layout.distance, Math.cos(elevation) * layout.distance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function pointOnInsert([pixelX, pixelY], layout, camera) {
  const point = new THREE.Vector3(
    pixelX / layout.sourceSize[0] * 2 - 1,
    1 - pixelY / layout.sourceSize[1] * 2,
    0.5
  ).unproject(camera);
  const ray = point.sub(camera.position).normalize();
  const distance = -camera.position.y / ray.y;
  return [camera.position.x + ray.x * distance, camera.position.z + ray.z * distance];
}

function makeInsert(layout) {
  const camera = cameraFor(layout);
  const vertices = layout.opening.map((point) => pointOnInsert(point, layout, camera));
  const minX = Math.min(...vertices.map(([x]) => x));
  const maxX = Math.max(...vertices.map(([x]) => x));
  const minZ = Math.min(...vertices.map(([, z]) => z));
  const maxZ = Math.max(...vertices.map(([, z]) => z));
  const outline = new THREE.Shape();
  outline.moveTo(minX, minZ);
  outline.lineTo(maxX, minZ);
  outline.lineTo(maxX, maxZ);
  outline.lineTo(minX, maxZ);
  outline.closePath();

  const socketSize = Math.min(
    (maxX - minX) / (layout.columns + (layout.columns - 1) * 0.16 + 1.4),
    (maxZ - minZ) / (layout.rows + (layout.rows - 1) * 0.16 + 1.4)
  );
  const endMargin = socketSize * perspective.insert.rimSocketRatio;
  const pitchX = (maxX - minX - 2 * endMargin - socketSize) / (layout.columns - 1);
  const pitchZ = (maxZ - minZ - 2 * endMargin - socketSize) / (layout.rows - 1);
  const centerX = (minX + maxX) / 2;
  const gridWidth = (layout.columns - 1) * pitchX + socketSize;
  const gridBack = minZ + endMargin;
  const gridFront = maxZ - endMargin;
  const gridLeft = centerX - gridWidth / 2;
  const ring = outline.clone();
  const opening = new THREE.Path();
  opening.moveTo(gridLeft, gridBack);
  opening.lineTo(gridLeft, gridFront);
  opening.lineTo(gridLeft + gridWidth, gridFront);
  opening.lineTo(gridLeft + gridWidth, gridBack);
  opening.closePath();
  ring.holes.push(opening);

  const top = new THREE.MeshBasicMaterial({
    name: 'Dense charcoal damping foam', color: 0x24272e
  });
  const walls = new THREE.MeshBasicMaterial({
    name: 'Recessed foam socket walls', color: 0x161a20
  });
  const floor = new THREE.MeshBasicMaterial({
    name: 'Dark socket floors', color: 0x0c0f14
  });

  // One large polygon with many holes makes Earcut bridge distant cavities with stray triangles.
  // A single opening plus separate ribs keeps every socket genuinely recessed and unoccluded.
  const textureScale = socketSize * 2.2;
  const applyPlanarUv = (geometry, offsetX = 0, offsetZ = 0) => {
    const positions = geometry.getAttribute('position');
    const uv = new Float32Array(positions.count * 2);
    for (let index = 0; index < positions.count; index++) {
      uv[index * 2] = (positions.getX(index) + offsetX - minX) / textureScale;
      uv[index * 2 + 1] = (positions.getZ(index) + offsetZ - minZ) / textureScale;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  };
  const foamGeometry = new THREE.ExtrudeGeometry(ring, { depth, bevelEnabled: false });
  foamGeometry.rotateX(Math.PI / 2);
  applyPlanarUv(foamGeometry);
  const foam = new THREE.Mesh(foamGeometry, [top, walls]);
  foam.name = 'Continuous foam perimeter';

  const ribs = [];
  const rib = (width, length, x, z) => {
    const geometry = new THREE.BoxGeometry(width, depth, length);
    applyPlanarUv(geometry, x, z);
    const mesh = new THREE.Mesh(geometry, [walls, walls, top, walls, walls, walls]);
    mesh.position.set(x, -depth / 2, z);
    mesh.name = 'Foam socket bridge';
    ribs.push(mesh);
  };
  for (let row = 0; row < layout.rows - 1; row++) {
    rib(gridWidth, pitchZ - socketSize, centerX, gridBack + socketSize + row * pitchZ + (pitchZ - socketSize) / 2);
  }
  for (let row = 0; row < layout.rows; row++) {
    const z = gridBack + socketSize / 2 + row * pitchZ;
    for (let column = 0; column < layout.columns - 1; column++) {
      const x = gridLeft + socketSize + column * pitchX + (pitchX - socketSize) / 2;
      rib(pitchX - socketSize, socketSize, x, z);
    }
  }
  if (layout.rows * layout.columns !== 40) throw new Error('Expected 40 sockets');

  const baseGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: false });
  baseGeometry.rotateX(Math.PI / 2);
  applyPlanarUv(baseGeometry);
  const base = new THREE.Mesh(baseGeometry, floor);
  base.position.y = -depth + 0.01;
  base.name = 'Socket floors below foam surface';

  const group = new THREE.Group();
  group.name = `${layout.columns} columns by ${layout.rows} rows damping insert`;
  group.userData = {
    columns: layout.columns,
    rows: layout.rows,
    socketSize,
    rimSocketRatio: perspective.insert.rimSocketRatio,
    gridOriginX: gridLeft + socketSize / 2,
    gridOriginZ: gridBack + socketSize / 2,
    pitchX,
    pitchZ,
    frontSocketX: centerX - pitchX / 2,
    frontSocketZ: maxZ - endMargin - socketSize / 2,
    depth
  };
  group.add(foam, ...ribs, base);
  return group;
}

for (const layout of textureOnly ? [] : [perspective.landscape, perspective.portrait]) {
  if (haloOnly) {
    await writeHaloMask(layout);
    continue;
  }
  if (!modelsOnly) {
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.sourceSize[0]}" height="${layout.sourceSize[1]}"><polygon points="${layout.opening.map((point) => point.join(',')).join(' ')}" fill="white"/></svg>`;
    const cutout = await sharp(resolve(sourceDirectory, layout.source))
      .composite([{ input: Buffer.from(mask), blend: 'dest-out' }])
      .png()
      .toBuffer();
    await sharp(cutout)
      .resize(...layout.assetSize)
      .webp({ quality: 88, effort: 6 })
      .toFile(resolve(outputDirectory, layout.asset));
    await writeHaloMask(layout);
  }

  const data = await new GLTFExporter().parseAsync(makeInsert(layout), { binary: true });
  await writeFile(resolve(outputDirectory, layout.model), Buffer.from(data));
  console.log(`${layout.model}: ${layout.columns} × ${layout.rows} sockets`);
}
