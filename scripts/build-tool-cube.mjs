import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

// The six faces share one site-specific metal material. Tool icons are added
// by the toolbox viewer, so this GLB remains reusable for every tool.
const output = resolve('public/assets/toolbox/rounded-metal-cube.glb');
const textureOutput = resolve('public/assets/toolbox/metal-face-v2.webp');
const source = resolve('docs/design-references/tool-cube/metal-face-source-v2.png');
const size = 1024;
await mkdir(dirname(textureOutput), { recursive: true });
await sharp(source)
  .resize(size, size)
  .modulate({ brightness: 0.68, saturation: 0.88 })
  .webp({ quality: 88, effort: 6 })
  .toFile(textureOutput);
const colorJpeg = await sharp(textureOutput).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
const { data: color } = await sharp(textureOutput).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const metalSize = 256;
const metal = Buffer.alloc(metalSize * metalSize * 3);

function noise(x, y) {
  let value = Math.imul(x + 71, 374761393) + Math.imul(y + 29, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

for (let y = 0; y < metalSize; y++) {
  for (let x = 0; x < metalSize; x++) {
    const i = (y * metalSize + x) * 3;
    const colorIndex = ((y * 4) * size + x * 4) * 3;
    const center = x > metalSize * 0.16 && x < metalSize * 0.84 && y > metalSize * 0.16 && y < metalSize * 0.84;
    const copper = color[colorIndex] > color[colorIndex + 2] * 1.5 && color[colorIndex] > color[colorIndex + 1] * 1.1;
    const grain = (noise(x, y) - 0.5) * 14;
    metal[i] = 255;
    metal[i + 1] = Math.round((center ? 142 : copper ? 112 : 132) + grain);
    metal[i + 2] = center ? 162 : copper ? 196 : 205;
  }
}

const metalPng = await sharp(metal, { raw: { width: metalSize, height: metalSize, channels: 3 } }).png().toBuffer();

const edge = [-1, -0.995, -0.975, -0.94, -0.88, -0.55, 0, 0.55, 0.88, 0.94, 0.975, 0.995, 1];
const radius = 0.12;
const positions = [];
const normals = [];
const uvs = [];
const indices = [];
const faces = [
  (u, v) => [u, v, 1],
  (u, v) => [-u, v, -1],
  (u, v) => [1, u, v],
  (u, v) => [-1, -u, v],
  (u, v) => [v, 1, u],
  (u, v) => [v, -1, -u]
];

for (const face of faces) {
  const base = positions.length / 3;
  for (let row = 0; row < edge.length; row++) {
    for (let col = 0; col < edge.length; col++) {
      const point = face(edge[col], edge[row]);
      const core = point.map((value) => Math.max(-1 + radius, Math.min(1 - radius, value)));
      const delta = point.map((value, axis) => value - core[axis]);
      const length = Math.hypot(...delta);
      const normal = delta.map((value) => value / length);
      positions.push(...core.map((value, axis) => value + normal[axis] * radius));
      normals.push(...normal);
      uvs.push((edge[col] + 1) / 2, (edge[row] + 1) / 2);
    }
  }
  for (let row = 0; row < edge.length - 1; row++) {
    for (let col = 0; col < edge.length - 1; col++) {
      const a = base + row * edge.length + col;
      const b = a + 1;
      const c = a + edge.length;
      indices.push(a, b, c, b, c + 1, c);
    }
  }
}

// Every face also carries physical layers above the rounded casting. These
// parts have real depth and normals; the bitmap only supplies fine grain.
const detail = Array.from({ length: 7 }, () => ({ positions: [], normals: [] }));
const axes = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [1, 0, 0], [0, -1, 0]]
];

function point(face, u, v, depth) {
  const [right, up, outward] = axes[face];
  return right.map((value, axis) => value * u + up[axis] * v + outward[axis] * depth);
}

function triangle(material, a, b, c) {
  const ab = b.map((value, axis) => value - a[axis]);
  const ac = c.map((value, axis) => value - a[axis]);
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  const length = Math.hypot(...normal);
  for (const vertex of [a, b, c]) {
    detail[material].positions.push(...vertex);
    detail[material].normals.push(...normal.map((value) => value / length));
  }
}

function quad(material, a, b, c, d) {
  triangle(material, a, b, c);
  triangle(material, a, c, d);
}

function octagon(half, cut) {
  return [
    [-half + cut, -half], [half - cut, -half],
    [half, -half + cut], [half, half - cut],
    [half - cut, half], [-half + cut, half],
    [-half, half - cut], [-half, -half + cut]
  ];
}

function ring(material, face, outer, inner, back, front) {
  for (let i = 0; i < outer.length; i++) {
    const next = (i + 1) % outer.length;
    const of = point(face, ...outer[i], front);
    const nf = point(face, ...outer[next], front);
    const ib = point(face, ...inner[i], front);
    const nb = point(face, ...inner[next], front);
    quad(material, of, nf, nb, ib);
    quad(material, of, point(face, ...outer[i], back), point(face, ...outer[next], back), nf);
    quad(material, nb, point(face, ...inner[next], back), point(face, ...inner[i], back), ib);
  }
}

function beveledRing(material, face, outerBack, outerFront, innerFront, innerBack, back, front) {
  for (let i = 0; i < outerFront.length; i++) {
    const next = (i + 1) % outerFront.length;
    const a = point(face, ...outerFront[i], front);
    const b = point(face, ...outerFront[next], front);
    const c = point(face, ...innerFront[next], front);
    const d = point(face, ...innerFront[i], front);
    quad(material, a, b, c, d);
    quad(material, a, point(face, ...outerBack[i], back), point(face, ...outerBack[next], back), b);
    quad(material, c, point(face, ...innerBack[next], back), point(face, ...innerBack[i], back), d);
  }
}

function raisedPlate(material, face, outline, back, front) {
  const center = point(
    face,
    outline.reduce((sum, vertex) => sum + vertex[0], 0) / outline.length,
    outline.reduce((sum, vertex) => sum + vertex[1], 0) / outline.length,
    front
  );
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    const a = point(face, ...outline[i], front);
    const b = point(face, ...outline[next], front);
    triangle(material, center, a, b);
    quad(material, a, point(face, ...outline[i], back), point(face, ...outline[next], back), b);
  }
}

function rectangle(cx, cy, halfWidth, halfHeight, angle = 0) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [
    cx + x * halfWidth * cos - y * halfHeight * sin,
    cy + x * halfWidth * sin + y * halfHeight * cos
  ]);
}

for (let face = 0; face < 6; face++) {
  ring(0, face, octagon(0.848, 0.17), octagon(0.644, 0.11), 1.002, 1.008); // shadow gasket
  beveledRing(1, face,
    octagon(0.822, 0.16), octagon(0.79, 0.15),
    octagon(0.7, 0.118), octagon(0.682, 0.115),
    1.009, 1.058); // chamfered alloy rim
  ring(2, face, octagon(0.696, 0.118), octagon(0.664, 0.112), 1.059, 1.067); // copper joint
  raisedPlate(3, face, octagon(0.652, 0.11), 1.008, 1.028); // recessed icon well
  for (const x of [-0.845, 0.845]) {
    for (const y of [-0.845, 0.845]) {
      const fastener = Array.from({ length: 12 }, (_, index) => {
        const angle = index * Math.PI / 6;
        return [x + Math.cos(angle) * 0.033, y + Math.sin(angle) * 0.033];
      });
      raisedPlate(4, face, fastener, 1.002, 1.027);
      raisedPlate(5, face, rectangle(x, y, 0.023, 0.0045, Math.PI / 4), 1.027, 1.03);
    }
  }
  for (const sign of [-1, 1]) {
    raisedPlate(6, face, rectangle(sign * 0.719, sign * 0.719, 0.055, 0.012, -Math.PI / 4), 1.058, 1.069);
  }
}

const chunks = [];
const bufferViews = [];
let byteLength = 0;
function append(data, target) {
  const offset = byteLength;
  chunks.push(data);
  byteLength += data.length;
  const padding = (4 - (byteLength % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    byteLength += padding;
  }
  const view = { buffer: 0, byteOffset: offset, byteLength: data.length };
  if (target) view.target = target;
  bufferViews.push(view);
  return bufferViews.length - 1;
}

const accessors = [];
function attribute(values, type) {
  const view = append(Buffer.from(new Float32Array(values).buffer), 34962);
  const dimensions = type === 'VEC3' ? 3 : 2;
  const accessor = { bufferView: view, componentType: 5126, count: values.length / dimensions, type };
  if (type === 'VEC3') {
    accessor.min = [Infinity, Infinity, Infinity];
    accessor.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < values.length; i++) {
      const axis = i % 3;
      accessor.min[axis] = Math.min(accessor.min[axis], values[i]);
      accessor.max[axis] = Math.max(accessor.max[axis], values[i]);
    }
  }
  accessors.push(accessor);
  return accessors.length - 1;
}

const primitives = [{
  attributes: { POSITION: attribute(positions, 'VEC3'), NORMAL: attribute(normals, 'VEC3'), TEXCOORD_0: attribute(uvs, 'VEC2') },
  indices: accessors.push({ bufferView: append(Buffer.from(new Uint16Array(indices).buffer), 34963), componentType: 5123, count: indices.length, type: 'SCALAR' }) - 1,
  material: 0
}];
for (let material = 0; material < detail.length; material++) {
  const geometry = detail[material];
  primitives.push({
    attributes: { POSITION: attribute(geometry.positions, 'VEC3'), NORMAL: attribute(geometry.normals, 'VEC3') },
    material: material + 1
  });
}
const colorView = append(colorJpeg);
const metalView = append(metalPng);

const gltf = {
  asset: { version: '2.0', generator: 'Hatrix rounded tool cube' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Reusable rounded metal cube' }],
  meshes: [{ primitives }],
  materials: [{
    name: 'H-3 platinum alloy faceplate',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      baseColorFactor: [0.4, 0.44, 0.52, 1],
      metallicRoughnessTexture: { index: 1 },
      metallicFactor: 0.8,
      roughnessFactor: 1
    }
  },
  { name: 'Recess gasket', pbrMetallicRoughness: { baseColorFactor: [0.025, 0.029, 0.04, 1], metallicFactor: 0.25, roughnessFactor: 0.78 } },
  { name: 'Raised platinum armor rim', pbrMetallicRoughness: { baseColorFactor: [0.06, 0.08, 0.12, 1], metallicFactor: 0.72, roughnessFactor: 0.58 } },
  { name: 'Copper joint', pbrMetallicRoughness: { baseColorFactor: [0.22, 0.075, 0.02, 1], metallicFactor: 0.84, roughnessFactor: 0.32 } },
  { name: 'Graphite icon well', pbrMetallicRoughness: { baseColorFactor: [0.003, 0.005, 0.009, 1], metallicFactor: 0, roughnessFactor: 1 } },
  { name: 'Fastener caps', pbrMetallicRoughness: { baseColorFactor: [0.15, 0.18, 0.23, 1], metallicFactor: 0.9, roughnessFactor: 0.33 } },
  { name: 'Fastener slots', pbrMetallicRoughness: { baseColorFactor: [0.018, 0.021, 0.03, 1], metallicFactor: 0.2, roughnessFactor: 0.75 } },
  { name: 'Cyan index lights', pbrMetallicRoughness: { baseColorFactor: [0.005, 0.13, 0.17, 1], metallicFactor: 0.12, roughnessFactor: 0.38 }, emissiveFactor: [0.0, 0.14, 0.18] }],
  textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [
    { mimeType: 'image/jpeg', bufferView: colorView },
    { mimeType: 'image/png', bufferView: metalView }
  ],
  accessors,
  bufferViews,
  buffers: [{ byteLength }]
};

const json = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - (json.length % 4)) % 4;
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const binaryChunk = Buffer.concat(chunks);
const header = Buffer.alloc(12);
header.write('glTF');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length);
jsonHeader.write('JSON', 4);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binaryChunk.length);
binaryHeader.write('BIN\0', 4);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([header, jsonHeader, jsonChunk, binaryHeader, binaryChunk]));
console.log(`${output} (${(header.length + 8 + jsonChunk.length + 8 + binaryChunk.length) / 1024 | 0} KiB)`);
