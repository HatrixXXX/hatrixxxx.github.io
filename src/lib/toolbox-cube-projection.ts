import * as THREE from 'three';

const screenYAxis = new THREE.Vector3();
const screenYAxisRotation = new THREE.Quaternion();

interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function rotateQuaternionAroundScreenYAxis(
  objectQuaternion: THREE.Quaternion,
  cameraQuaternion: THREE.Quaternion,
  angle: number
) {
  screenYAxis.set(0, 1, 0).applyQuaternion(cameraQuaternion).normalize();
  screenYAxisRotation.setFromAxisAngle(screenYAxis, angle);
  return objectQuaternion.premultiply(screenYAxisRotation);
}

export function matchQuaternionAcrossCameras(
  objectQuaternion: THREE.Quaternion,
  sourceCameraQuaternion: THREE.Quaternion,
  targetCameraQuaternion: THREE.Quaternion
) {
  return targetCameraQuaternion.clone()
    .multiply(sourceCameraQuaternion.clone().invert())
    .multiply(objectQuaternion);
}

export function calculateInspectionStartPose(
  camera: THREE.PerspectiveCamera,
  canvas: ViewportRect,
  source: ViewportRect,
  cubeSize: number
) {
  const sourceCenterX = source.left + source.width / 2;
  const sourceCenterY = source.top + source.height / 2;
  const pointer = new THREE.Vector3(
    (sourceCenterX - canvas.left) / canvas.width * 2 - 1,
    1 - (sourceCenterY - canvas.top) / canvas.height * 2,
    0.5
  ).unproject(camera);
  const direction = pointer.sub(camera.position).normalize();
  const planeNormal = camera.getWorldDirection(new THREE.Vector3());
  const distanceAlongRay = -camera.position.dot(planeNormal) / direction.dot(planeNormal);
  const position = camera.position.clone().addScaledVector(direction, distanceAlongRay);
  const depth = Math.abs(position.clone().applyMatrix4(camera.matrixWorldInverse).z);
  const worldHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  return {
    position,
    scale: Math.max(source.width, source.height) / canvas.height * worldHeight / cubeSize
  };
}

export function calculateSocketCubePose(
  camera: THREE.PerspectiveCamera,
  socketCenter: THREE.Vector3,
  socketSize: number,
  cubeSize: number
) {
  // Perspective projection is unchanged along a camera ray. Put every point
  // on the cube's top face at Q = C + lambda * (S - C), where S is the
  // corresponding socket point. A shallow exposed height keeps the side walls
  // behind the insert rim while all four projected top edges remain aligned.
  const exposedHeight = socketSize * 0.05;
  const lambda = 1 - exposedHeight / camera.position.y;
  const worldSize = lambda * socketSize;
  const topCenter = camera.position.clone().lerp(socketCenter, lambda);
  return {
    position: topCenter.addScaledVector(THREE.Object3D.DEFAULT_UP, -worldSize / 2),
    quaternion: new THREE.Quaternion(),
    scale: worldSize / cubeSize
  };
}
