import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, test } from 'vitest';
import perspective from '../../src/config/toolbox-perspective.json';

test.each([
  { key: 'landscape', columns: 10, rows: 4 },
  { key: 'portrait', columns: 4, rows: 10 }
] as const)('$key insert has 40 clear, evenly placed sockets with a rim', async ({ key, columns, rows }) => {
  const layout = perspective[key];
  expect([layout.columns, layout.rows]).toEqual([columns, rows]);

  const file = await readFile(resolve('public/assets/toolbox', layout.model));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const { scene } = await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '');
  scene.updateMatrixWorld(true);
  const insert = scene.children[0];
  expect([insert.userData.columns, insert.userData.rows]).toEqual([columns, rows]);
  const floor = scene.getObjectByName('Socket_floors_below_foam_surface') as THREE.Mesh;
  const positions = floor.geometry.getAttribute('position');
  const footprint = Array.from({ length: positions.count }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(floor.matrixWorld)
  );
  expect(new Set(footprint.map((point) => point.x.toFixed(3))).size, 'insert width must be rectangular').toBe(2);
  expect(new Set(footprint.map((point) => point.z.toFixed(3))).size, 'insert length must be rectangular').toBe(2);
  const minX = Math.min(...footprint.map((point) => point.x));
  const maxX = Math.max(...footprint.map((point) => point.x));
  const minZ = Math.min(...footprint.map((point) => point.z));
  const maxZ = Math.max(...footprint.map((point) => point.z));

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
  const outline = layout.opening.map(([pixelX, pixelY]) => {
    const target = new THREE.Vector3(
      pixelX / layout.sourceSize[0] * 2 - 1,
      1 - pixelY / layout.sourceSize[1] * 2,
      0.5
    ).unproject(camera);
    const ray = target.sub(camera.position).normalize();
    const distance = -camera.position.y / ray.y;
    return new THREE.Vector2(ray.x * distance, camera.position.z + ray.z * distance);
  });
  const socketSize = insert.userData.socketSize as number;
  const rimRatio = perspective.insert.rimSocketRatio;
  for (const point of outline) {
    expect(point.x).toBeGreaterThanOrEqual(minX - 0.001);
    expect(point.x).toBeLessThanOrEqual(maxX + 0.001);
    expect(point.y).toBeGreaterThanOrEqual(minZ - 0.001);
    expect(point.y).toBeLessThanOrEqual(maxZ + 0.001);
  }
  const pitchX = (maxX - minX - socketSize * (1 + rimRatio * 2)) / (columns - 1);
  const pitchZ = (maxZ - minZ - socketSize * (1 + rimRatio * 2)) / (rows - 1);
  const centerX = (minX + maxX) / 2;
  const gridBack = minZ + socketSize * rimRatio;
  const gridFront = maxZ - socketSize * rimRatio;
  const project = (x: number, z: number) => {
    const point = new THREE.Vector3(x, 0, z).project(camera);
    return new THREE.Vector2(
      (point.x + 1) * layout.sourceSize[0] / 2,
      (1 - point.y) * layout.sourceSize[1] / 2
    );
  };
  const projectedLeft = [project(minX + socketSize * rimRatio, gridBack), project(minX + socketSize * rimRatio, gridFront)];
  const projectedRight = [project(maxX - socketSize * rimRatio, gridBack), project(maxX - socketSize * rimRatio, gridFront)];
  const slope = ([start, end]: THREE.Vector2[]) => (end.x - start.x) / (end.y - start.y);
  const shellLeftSlope = (layout.opening[6][0] - layout.opening[7][0]) / (layout.opening[6][1] - layout.opening[7][1]);
  const shellRightSlope = (layout.opening[3][0] - layout.opening[2][0]) / (layout.opening[3][1] - layout.opening[2][1]);
  expect(Math.abs(slope(projectedLeft) - shellLeftSlope), 'left socket edge must be parallel to the shell').toBeLessThan(0.005);
  expect(Math.abs(slope(projectedRight) - shellRightSlope), 'right socket edge must be parallel to the shell').toBeLessThan(0.005);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const foamTopMaterials = meshes.flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter((material) => material.name === 'Dense charcoal damping foam');
  expect(foamTopMaterials.length).toBeGreaterThan(0);
  expect(foamTopMaterials.every((material) => material instanceof THREE.MeshBasicMaterial), 'insert surface should ignore scene highlights').toBe(true);
  const insertMaterials = meshes.flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter((material, index, materials) => [
      'Dense charcoal damping foam', 'Recessed foam socket walls', 'Dark socket floors'
    ].includes(material.name) && materials.indexOf(material) === index) as THREE.MeshBasicMaterial[];
  expect(insertMaterials).toHaveLength(3);
  const expectedFinish = new Map([
    ['Dense charcoal damping foam', { color: '#24272e' }],
    ['Recessed foam socket walls', { color: '#161a20' }],
    ['Dark socket floors', { color: '#0c0f14' }]
  ]);
  for (const material of insertMaterials) {
    const expected = expectedFinish.get(material.name)!;
    expect(`#${material.color.getHexString()}`, `${material.name} color`).toBe(expected.color);
    expect(material.map, `${material.name} should have no albedo noise texture`).toBeNull();
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = centerX + (column - (columns - 1) / 2) * pitchX;
      const z = minZ + socketSize * (rimRatio + 0.5) + row * pitchZ;
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0))
        .intersectObjects(meshes);
      expect(hits[0]?.point.y, `socket ${column + 1},${row + 1} is blocked`).toBeLessThan(-0.5);

      if (row === 0 || row === rows - 1) {
        if (column === 0 || column === columns - 1) {
          const cornerClearances: number[] = [];
          for (const dx of [-0.5, 0.5]) {
            for (const dz of [-0.5, 0.5]) {
              const cornerX = x + dx * socketSize;
              const cornerZ = z + dz * socketSize;
              const clearance = Math.min(cornerX - minX, maxX - cornerX, cornerZ - minZ, maxZ - cornerZ);
              cornerClearances.push(clearance / socketSize);
            }
          }
          expect(Math.min(...cornerClearances), 'socket rim should stay compact and even').toBeCloseTo(rimRatio, 1);
        }
      }
    }
  }

  expect(insert.userData.frontSocketX).toBeCloseTo(centerX - pitchX / 2);
});
