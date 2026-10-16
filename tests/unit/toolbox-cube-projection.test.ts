import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, test } from 'vitest';
import perspective from '../../src/config/toolbox-perspective.json';
import {
  calculateInspectionStartPose,
  calculateSocketCubePose,
  rotateQuaternionAroundScreenYAxis
} from '../../src/lib/toolbox-cube-projection';

const layouts = [
  { key: 'landscape', layout: perspective.landscape },
  { key: 'portrait', layout: perspective.portrait }
] as const;

const loadScene = async (filename: string) => {
  const file = await readFile(resolve('public/assets/toolbox', filename));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
};

const loadCubeSize = async () => {
  const file = await readFile(resolve('public/assets/toolbox/rounded-metal-cube.glb'));
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as {
    accessors: Array<{ type: string; min?: number[]; max?: number[] }>;
  };
  return Math.max(...json.accessors
    .filter((accessor) => accessor.type === 'VEC3' && accessor.min && accessor.max)
    .map((accessor) => accessor.max![0] - accessor.min![0]));
};

const project = (point: THREE.Vector3, camera: THREE.Camera) => {
  const projected = point.project(camera);
  return new THREE.Vector2(projected.x, projected.y);
};

const parallelError = (a: THREE.Vector2, b: THREE.Vector2) =>
  Math.abs(a.cross(b)) / (a.length() * b.length());

test('maps an enlarged-canvas pose back to the clicked cube position and size', () => {
  const camera = new THREE.PerspectiveCamera(36, 760 / 650, 0.1, 60);
  camera.position.set(0, -0.55, 6.1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const canvas = { left: 100, top: 80, width: 760, height: 650 };
  const source = { left: 248, top: 396, width: 52, height: 44 };

  const pose = calculateInspectionStartPose(camera, canvas, source, 2);
  const projected = pose.position.clone().project(camera);
  const screenX = canvas.left + (projected.x + 1) * canvas.width / 2;
  const screenY = canvas.top + (1 - projected.y) * canvas.height / 2;
  const distance = Math.abs(pose.position.clone().applyMatrix4(camera.matrixWorldInverse).z);
  const projectedSize = pose.scale * 2 / (
    2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  ) * canvas.height;

  expect(screenX).toBeCloseTo(source.left + source.width / 2, 5);
  expect(screenY).toBeCloseTo(source.top + source.height / 2, 5);
  expect(projectedSize).toBeCloseTo(Math.max(source.width, source.height), 5);
});

test('rotates an inspected cube around the camera screen vertical axis', () => {
  const cameraQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, -0.41, 0.33));
  const initialPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, 0.71, -0.37));
  const angle = 0.27;
  const screenYAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion).normalize();
  const expected = new THREE.Quaternion().setFromAxisAngle(screenYAxis, angle).multiply(initialPose);
  const localAxisResult = initialPose.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)
  );

  const actual = rotateQuaternionAroundScreenYAxis(initialPose.clone(), cameraQuaternion, angle);

  expect(actual.angleTo(expected)).toBeLessThan(1e-10);
  expect(actual.angleTo(localAxisResult)).toBeGreaterThan(0.01);
});

describe.each(layouts)('$key toolbox cube projection', ({ layout }) => {
  test('keeps the cube side below the socket rim instead of crossing the next row', async () => {
    const insertScene = await loadScene(layout.model);
    const insert = insertScene.children[0];
    const cubeSize = await loadCubeSize();
    const data = insert.userData as {
      socketSize: number;
      gridOriginX: number;
      gridOriginZ: number;
    };
    const elevation = THREE.MathUtils.degToRad(layout.elevation);
    const camera = new THREE.PerspectiveCamera(
      perspective.camera.fov,
      layout.assetSize[0] / layout.assetSize[1],
      0.1,
      60
    );
    camera.position.set(0, Math.sin(elevation) * layout.distance, Math.cos(elevation) * layout.distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const pose = calculateSocketCubePose(
      camera,
      new THREE.Vector3(data.gridOriginX, 0, data.gridOriginZ),
      data.socketSize,
      cubeSize
    );
    const topHeight = pose.position.y + pose.scale * cubeSize / 2;

    expect(topHeight / data.socketSize).toBeLessThanOrEqual(0.06);
  });

  test('keeps every cube top edge parallel to its corresponding socket edge', async () => {
    const insertScene = await loadScene(layout.model);
    const insert = insertScene.children[0];
    const cubeSize = await loadCubeSize();
    const data = insert.userData as {
      columns: number;
      rows: number;
      socketSize: number;
      gridOriginX: number;
      gridOriginZ: number;
      pitchX: number;
      pitchZ: number;
    };
    const elevation = THREE.MathUtils.degToRad(layout.elevation);
    const camera = new THREE.PerspectiveCamera(
      perspective.camera.fov,
      layout.assetSize[0] / layout.assetSize[1],
      0.1,
      60
    );
    camera.position.set(0, Math.sin(elevation) * layout.distance, Math.cos(elevation) * layout.distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    for (let row = 0; row < data.rows; row++) {
      for (let column = 0; column < data.columns; column++) {
        const center = new THREE.Vector3(
          data.gridOriginX + column * data.pitchX,
          0,
          data.gridOriginZ + row * data.pitchZ
        );
        const pose = calculateSocketCubePose(camera, center, data.socketSize, cubeSize);
        const cubeMatrix = new THREE.Matrix4().compose(
          pose.position,
          pose.quaternion,
          new THREE.Vector3().setScalar(pose.scale)
        );
        const halfSocket = data.socketSize / 2;
        const halfCube = cubeSize / 2;
        const socketCorners = [
          new THREE.Vector3(-halfSocket, 0, -halfSocket),
          new THREE.Vector3(halfSocket, 0, -halfSocket),
          new THREE.Vector3(halfSocket, 0, halfSocket),
          new THREE.Vector3(-halfSocket, 0, halfSocket)
        ].map((corner) => project(corner.add(center), camera));
        const cubeCorners = [
          new THREE.Vector3(-halfCube, halfCube, -halfCube),
          new THREE.Vector3(halfCube, halfCube, -halfCube),
          new THREE.Vector3(halfCube, halfCube, halfCube),
          new THREE.Vector3(-halfCube, halfCube, halfCube)
        ].map((corner) => project(corner.applyMatrix4(cubeMatrix), camera));

        for (let edge = 0; edge < 4; edge++) {
          const next = (edge + 1) % 4;
          const socketEdge = socketCorners[next].clone().sub(socketCorners[edge]);
          const cubeEdge = cubeCorners[next].clone().sub(cubeCorners[edge]);
          expect(
            parallelError(socketEdge, cubeEdge),
            `socket ${column + 1},${row + 1} edge ${edge + 1}`
          ).toBeLessThan(1e-6);
        }
      }
    }
  });
});
