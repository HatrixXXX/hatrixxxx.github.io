import * as THREE from 'three';
import { animate } from 'animejs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import perspective from '@/config/toolbox-perspective.json';
import {
  calculateInspectionStartPose,
  calculateSocketCubePose,
  matchQuaternionAcrossCameras,
  rotateQuaternionAroundScreenYAxis
} from '@/lib/toolbox-cube-projection';

const toolboxAssetRevision = '20261016-v20';
const minimumLiftMs = 420;
const inspectionAutoRotationSpeed = 0.000704;
const inspectionFloatAmplitude = 0.18;
const inspectionFloatPeriod = 2400;

export function mountToolCube(root: HTMLElement): () => void {
  const triggers = [...root.querySelectorAll<HTMLButtonElement>('[data-cube-trigger]')];
  const trigger = triggers[0];
  const preview = root.querySelector<HTMLElement>('[data-cube-preview]')!;
  const previewSnapshot = root.querySelector<HTMLCanvasElement>('[data-cube-preview-snapshot]')!;
  const restSnapshot = root.querySelector<HTMLCanvasElement>('[data-cube-rest-snapshot]')!;
  const expanded = root.querySelector<HTMLElement>('[data-cube-expanded]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-cube-dialog]')!;
  const info = root.querySelector<HTMLElement>('[data-cube-info]')!;
  const infoName = root.querySelector<HTMLElement>('[data-cube-name]')!;
  const infoDescription = root.querySelector<HTMLElement>('[data-cube-description]')!;
  const status = root.querySelector<HTMLElement>('[data-cube-status]')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowScreen = matchMedia('(max-width: 800px)');
  const tools = JSON.parse(root.dataset.tools ?? '[]') as Array<{ name: string; icon: string; description: string }>;
  let disposed = false;
  let active = false;
  let inspection: 'cube' | undefined;
  let opener = trigger;
  let interacting = false;
  let inspectionTransition: {
    startedAt: number;
    duration: number;
    startPosition: THREE.Vector3;
    endPosition: THREE.Vector3;
    startScale: number;
    endScale: number;
    startQuaternion: THREE.Quaternion;
    endQuaternion: THREE.Quaternion;
    closing: boolean;
  } | undefined;
  let pointerGesture: {
    pointerId: number;
    startedAt: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | undefined;
  let lastFrame = performance.now();
  let frame = 0;
  let iconTextures: THREE.Texture[] = [];
  let insertTopDetail: THREE.Texture | undefined;
  let insertSlotDetail: THREE.Texture | undefined;
  let shellTextures: THREE.Texture[] = [];
  let cubes: THREE.Group[] = [];
  let liftCubes: THREE.Group[] = [];
  const cubeRestY: number[] = [];
  const liftAnimations = new Map<number, ReturnType<typeof animate>>();
  const liftStartedAt = new Map<number, number>();
  const liftReturnTimers = new Map<number, number>();
  let liftDistance = 0;
  let inspectedCube: THREE.Group | undefined;
  let inspectionFloatStartedAt = 0;
  const inspectedRestQuaternion = new THREE.Quaternion();
  const previewCameraQuaternion = new THREE.Quaternion();
  let cubeBaseWidth = 2;
  let desktopFoam: THREE.Group | undefined;
  let mobileFoam: THREE.Group | undefined;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    triggers.forEach((button) => { button.disabled = true; });
    status.textContent = '此浏览器无法显示三维模型';
    preview.setAttribute('aria-busy', 'false');
    root.dataset.cubeUnavailable = '';
    return () => {};
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.85;
  renderer.domElement.dataset.cubeCanvas = '';
  renderer.domElement.setAttribute('aria-label', '拖动全方位旋转方块');
  preview.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  camera.position.set(0, 9, 10);
  camera.lookAt(0, 0, 0);
  const group = new THREE.Group();
  scene.add(group);
  const liftScene = new THREE.Scene();
  const liftGroup = new THREE.Group();
  liftScene.add(liftGroup);
  const shellScene = new THREE.Scene();
  const shellCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  shellCamera.position.z = 1;
  const shellMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const shellPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shellMaterial);
  shellScene.add(shellPlane);
  const keepBelowInsertSurface = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const keepAboveInsertSurface = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.55;
  liftScene.environment = environment.texture;
  liftScene.environmentIntensity = scene.environmentIntensity;
  room.dispose();
  const keyLight = new THREE.DirectionalLight(0xe5eaff, 3.4);
  keyLight.position.set(-3, 5, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x88e0eb, 1.7);
  rimLight.position.set(4, -2, -3);
  scene.add(rimLight);
  liftScene.add(keyLight.clone(), rimLight.clone());

  const renderPreview = () => {
    if (!shellTextures.length) {
      renderer.render(scene, camera);
      return;
    }
    const originalVisibility = cubes.map((cube) => cube.visible);
    const raised = cubes.map((cube, index) => cube.visible && cube.position.y > cubeRestY[index] + 0.001);
    shellMaterial.map = narrowScreen.matches ? shellTextures[1] : shellTextures[0];
    liftCubes.forEach((liftCube, index) => {
      liftCube.visible = raised[index];
      if (!raised[index]) return;
      liftCube.position.copy(cubes[index].position);
      liftCube.quaternion.copy(cubes[index].quaternion);
      liftCube.scale.copy(cubes[index].scale);
      cubes[index].visible = false;
    });
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, camera);
    if (raised.some(Boolean)) {
      renderer.clippingPlanes = [keepBelowInsertSurface];
      renderer.render(liftScene, camera);
      renderer.clippingPlanes = [];
    }
    renderer.clearDepth();
    renderer.render(shellScene, shellCamera);
    if (raised.some(Boolean)) {
      renderer.clippingPlanes = [keepAboveInsertSurface];
      renderer.clearDepth();
      renderer.render(liftScene, camera);
      renderer.clippingPlanes = [];
    }
    cubes.forEach((cube, index) => { cube.visible = originalVisibility[index]; });
    renderer.autoClear = true;
  };

  const captureRestSnapshot = () => {
    const originalY = cubes.map((cube) => cube.position.y);
    cubes.forEach((cube, index) => { cube.position.y = cubeRestY[index]; });
    renderPreview();
    restSnapshot.width = renderer.domElement.width;
    restSnapshot.height = renderer.domElement.height;
    restSnapshot.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
    cubes.forEach((cube, index) => { cube.position.y = originalY[index]; });
    if (cubes.some((cube, index) => cube.position.y !== cubeRestY[index])) renderPreview();
  };

  const capturePreviewSnapshot = (excludedCube: THREE.Group) => {
    const wasVisible = excludedCube.visible;
    excludedCube.visible = false;
    renderPreview();
    previewSnapshot.width = renderer.domElement.width;
    previewSnapshot.height = renderer.domElement.height;
    const context = previewSnapshot.getContext('2d');
    context?.clearRect(0, 0, previewSnapshot.width, previewSnapshot.height);
    context?.drawImage(renderer.domElement, 0, 0);
    excludedCube.visible = wasVisible;
  };

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.noZoom = true;
  controls.noPan = true;
  controls.mouseButtons.MIDDLE = null;
  controls.mouseButtons.RIGHT = null;
  controls.rotateSpeed = 2.5;
  controls.staticMoving = true;
  controls.minDistance = 3;
  controls.maxDistance = 80;
  controls.addEventListener('start', () => { interacting = true; });
  controls.addEventListener('end', () => {
    interacting = false;
    if (active && reducedMotion.matches) {
      controls.update();
      renderer.render(scene, camera);
    }
  });

  const resize = () => {
    const host = renderer.domElement.parentElement;
    if (!host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    controls.handleResize();
    if (!active) {
      if (cubes.length && shellTextures.length) captureRestSnapshot();
      else renderPreview();
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(preview);
  observer.observe(expanded);
  resize();

  const setPreviewPose = () => {
    const foam = narrowScreen.matches ? mobileFoam : desktopFoam;
    if (!foam || !desktopFoam || !mobileFoam) return;
    desktopFoam.visible = !narrowScreen.matches;
    mobileFoam.visible = narrowScreen.matches;
    const insert = foam.children[0].userData;
    const layout = narrowScreen.matches ? perspective.portrait : perspective.landscape;
    liftAnimations.forEach((motion) => motion.cancel());
    liftAnimations.clear();
    liftDistance = insert.socketSize * 1.2;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    group.rotation.set(0, 0, 0);
    camera.fov = perspective.camera.fov;
    camera.aspect = Math.max(1, preview.clientWidth) / Math.max(1, preview.clientHeight);
    camera.updateProjectionMatrix();
    const elevation = THREE.MathUtils.degToRad(layout.elevation);
    camera.position.set(0, Math.sin(elevation) * layout.distance, Math.cos(elevation) * layout.distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    previewCameraQuaternion.copy(camera.quaternion);
    cubes.forEach((cube, index) => {
      const row = Math.floor(index / insert.columns);
      const column = index % insert.columns;
      cube.visible = row < insert.rows;
      const socketCenter = new THREE.Vector3(
        insert.gridOriginX + column * insert.pitchX,
        0,
        insert.gridOriginZ + row * insert.pitchZ
      );
      const pose = calculateSocketCubePose(camera, socketCenter, insert.socketSize, cubeBaseWidth);
      cube.position.copy(pose.position);
      cubeRestY[index] = pose.position.y;
      if (triggers[index]?.matches(':hover, :focus-visible')) cube.position.y += liftDistance;
      cube.quaternion.copy(pose.quaternion);
      cube.scale.setScalar(pose.scale);
    });
    const firstSocket = new THREE.Vector3(insert.gridOriginX, 0, insert.gridOriginZ);
    const socketPosition = firstSocket.project(camera);
    root.style.setProperty('--cube-trigger-x', `${(socketPosition.x + 1) * 50}%`);
    root.style.setProperty('--cube-trigger-y', `${(1 - socketPosition.y) * 50}%`);
    cubes.forEach((cube, index) => {
      const button = triggers[index];
      if (!button) return;
      const row = Math.floor(index / insert.columns);
      const column = index % insert.columns;
      const socketCenter = new THREE.Vector3(
        insert.gridOriginX + column * insert.pitchX,
        0,
        insert.gridOriginZ + row * insert.pitchZ
      );
      const center = socketCenter.clone().project(camera);
      const left = socketCenter.clone().add(new THREE.Vector3(-insert.socketSize * 0.42, 0, 0)).project(camera);
      const right = socketCenter.clone().add(new THREE.Vector3(insert.socketSize * 0.42, 0, 0)).project(camera);
      const back = socketCenter.clone().add(new THREE.Vector3(0, 0, -insert.socketSize * 0.42)).project(camera);
      const front = socketCenter.clone().add(new THREE.Vector3(0, 0, insert.socketSize * 0.42)).project(camera);
      button.style.setProperty('--cube-trigger-x', `${(center.x + 1) * 50}%`);
      button.style.setProperty('--cube-trigger-y', `${(1 - center.y) * 50}%`);
      button.style.setProperty('--cube-trigger-width', `${Math.abs(right.x - left.x) * 50}%`);
      button.style.setProperty('--cube-trigger-height', `${Math.abs(front.y - back.y) * 50}%`);
      button.hidden = !cube.visible;
    });
  };
  const liftCube = (index: number, raised: boolean) => {
    const cube = cubes[index];
    if (!cube || active) return;
    const pendingReturn = liftReturnTimers.get(index);
    if (pendingReturn !== undefined) {
      clearTimeout(pendingReturn);
      liftReturnTimers.delete(index);
    }
    if (raised) {
      liftStartedAt.set(index, performance.now());
    } else {
      const remaining = minimumLiftMs - (performance.now() - (liftStartedAt.get(index) ?? -Infinity));
      if (!reducedMotion.matches && !document.hidden && remaining > 0) {
        liftReturnTimers.set(index, window.setTimeout(() => {
          liftReturnTimers.delete(index);
          liftStartedAt.delete(index);
          liftCube(index, false);
        }, remaining));
        return;
      }
      liftStartedAt.delete(index);
    }
    const targetY = cubeRestY[index] + (raised ? liftDistance : 0);
    liftAnimations.get(index)?.cancel();
    liftAnimations.delete(index);
    if (reducedMotion.matches || document.hidden) {
      cube.position.y = targetY;
      renderPreview();
      return;
    }
    liftAnimations.set(index, animate(cube.position, {
      y: targetY,
      duration: raised ? 260 : 180,
      ease: raised ? 'inOut(3)' : 'out(3)',
      onUpdate: () => { if (!active && !disposed) renderPreview(); },
      onComplete: () => {
        liftAnimations.delete(index);
        if (!active && !disposed) renderPreview();
      }
    }));
  };
  const onReducedMotionChange = () => {
    if (!active) {
      setPreviewPose();
      renderPreview();
    }
  };
  reducedMotion.addEventListener('change', onReducedMotionChange);
  const onLayoutChange = () => {
    if (!active) {
      setPreviewPose();
      resize();
    }
  };
  narrowScreen.addEventListener('change', onLayoutChange);

  const iconGeometry = new THREE.PlaneGeometry(1.18, 1.18);
  const orientations = [
    [0, 0, 1, 0, 0],
    [0, 0, -1, 0, Math.PI],
    [1, 0, 0, 0, Math.PI / 2],
    [-1, 0, 0, 0, -Math.PI / 2],
    [0, 1, 0, -Math.PI / 2, 0],
    [0, -1, 0, Math.PI / 2, 0]
  ];

  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  void Promise.all([
    loader.loadAsync(`/assets/toolbox/rounded-metal-cube.glb?v=${toolboxAssetRevision}`),
    loader.loadAsync(`/assets/toolbox/${perspective.landscape.model}?v=${toolboxAssetRevision}`),
    loader.loadAsync(`/assets/toolbox/${perspective.portrait.model}?v=${toolboxAssetRevision}`),
    textureLoader.loadAsync(`/assets/toolbox/${perspective.landscape.asset}?v=${toolboxAssetRevision}`),
    textureLoader.loadAsync(`/assets/toolbox/${perspective.portrait.asset}?v=${toolboxAssetRevision}`),
    textureLoader.loadAsync(`/assets/toolbox/insert-top-detail-v5.webp?v=${toolboxAssetRevision}`),
    textureLoader.loadAsync(`/assets/toolbox/insert-slot-detail-v5.webp?v=${toolboxAssetRevision}`),
    Promise.all(tools.map(({ icon }) => textureLoader.loadAsync(icon)))
  ]).then(([gltf, desktopInsert, mobileInsert, landscapeShell, portraitShell, loadedTopDetail, loadedSlotDetail, loadedIcons]) => {
    if (disposed) {
      loadedIcons.forEach((texture) => texture.dispose());
      loadedTopDetail.dispose();
      loadedSlotDetail.dispose();
      landscapeShell.dispose();
      portraitShell.dispose();
      for (const model of [gltf.scene, desktopInsert.scene, mobileInsert.scene]) {
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
      }
      return;
    }
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.envMapIntensity = material.name === 'Graphite icon well' ? 0.02 : 0.12;
        material.needsUpdate = true;
      }
    });
    cubeBaseWidth = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).x;
    iconTextures = loadedIcons;
    cubes = loadedIcons.map((iconTexture, index) => {
      iconTexture.colorSpace = THREE.SRGBColorSpace;
      iconTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const iconMaterial = new THREE.MeshBasicMaterial({
        map: iconTexture,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.FrontSide,
        toneMapped: false
      });
      const cube = gltf.scene.clone(true);
      cube.name = `${tools[index].name} tool cube`;
      for (const [x, y, z, rx, ry] of orientations) {
        const face = new THREE.Group();
        face.position.set(x * 1.035, y * 1.035, z * 1.035);
        face.rotation.set(rx, ry, 0);
        const icon = new THREE.Mesh(iconGeometry, iconMaterial);
        const image = iconTexture.image as HTMLImageElement;
        const aspect = image.naturalWidth / image.naturalHeight;
        if (aspect > 1) icon.scale.y = 1 / aspect;
        else icon.scale.x = aspect;
        icon.position.z = 0.01;
        face.add(icon);
        cube.add(face);
      }
      group.add(cube);
      return cube;
    });
    liftCubes = cubes.map((cube) => {
      const lifted = cube.clone(true);
      lifted.visible = false;
      liftGroup.add(lifted);
      return lifted;
    });
    desktopFoam = desktopInsert.scene;
    mobileFoam = mobileInsert.scene;
    shellTextures = [landscapeShell, portraitShell];
    shellTextures.forEach((texture) => { texture.colorSpace = THREE.SRGBColorSpace; });
    insertTopDetail = loadedTopDetail;
    insertSlotDetail = loadedSlotDetail;
    for (const texture of [insertTopDetail, insertSlotDetail]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    for (const foam of [desktopFoam, mobileFoam]) {
      foam.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshBasicMaterial && material.name === 'Dense charcoal damping foam') {
              material.map = loadedTopDetail;
              material.color.setHex(0x24272e);
              material.needsUpdate = true;
            }
            if (material instanceof THREE.MeshBasicMaterial && material.name === 'Recessed foam socket walls') {
              material.map = loadedSlotDetail;
              material.color.setHex(0x161a20);
              material.needsUpdate = true;
            }
            if (material instanceof THREE.MeshBasicMaterial && material.name === 'Dark socket floors') {
              material.map = loadedSlotDetail;
              material.color.setHex(0x0c0f14);
              material.needsUpdate = true;
            }
          }
        }
      });
    }
    scene.add(desktopFoam, mobileFoam);
    setPreviewPose();
    captureRestSnapshot();
    requestAnimationFrame(() => {
      if (disposed) return;
      status.hidden = true;
      preview.setAttribute('aria-busy', 'false');
      root.dataset.cubeCount = String(cubes.length);
      triggers.forEach((button) => { button.disabled = false; });
      root.dataset.cubeReady = '';
    });
  }).catch(() => {
    if (!disposed) {
      root.dataset.cubeError = '';
      status.textContent = '模型载入失败，请刷新页面';
      preview.setAttribute('aria-busy', 'false');
    }
  });

  const render = (now: number) => {
    if (disposed || !active) return;
    const delta = Math.min(now - lastFrame, 50);
    lastFrame = now;
    let finishClosing = false;
    if (document.visibilityState === 'visible') {
      if (reducedMotion.matches && !inspectionTransition && !interacting) {
        frame = requestAnimationFrame(render);
        return;
      }
      const transition = inspectionTransition;
      if (transition && inspectedCube) {
        if (!transition.closing && !reducedMotion.matches) {
          rotateQuaternionAroundScreenYAxis(
            transition.endQuaternion,
            camera.quaternion,
            delta * inspectionAutoRotationSpeed
          );
        }
        const elapsed = Math.min((now - transition.startedAt) / transition.duration, 1);
        const progress = 1 - Math.pow(1 - elapsed, 4);
        inspectedCube.position.lerpVectors(
          transition.startPosition,
          transition.endPosition,
          progress
        );
        if (!transition.closing && !reducedMotion.matches) {
          inspectedCube.position.y += Math.sin((now - inspectionFloatStartedAt) * Math.PI * 2 / inspectionFloatPeriod)
            * inspectionFloatAmplitude * progress;
        }
        inspectedCube.scale.setScalar(THREE.MathUtils.lerp(transition.startScale, transition.endScale, progress));
        inspectedCube.quaternion.slerpQuaternions(
          transition.startQuaternion,
          transition.endQuaternion,
          progress
        );
        if (transition.closing) {
          dialog.style.setProperty('--cube-backdrop-alpha', `${(1 - progress) * 62}%`);
          const settle = Math.min(1, Math.max(0, (elapsed - 0.68) / 0.32));
          restSnapshot.style.opacity = String(settle);
          renderer.domElement.style.opacity = String(1 - settle);
        }
        if (elapsed === 1) {
          finishClosing = transition.closing;
          inspectionTransition = undefined;
          delete root.dataset.cubeTransitioning;
          if (!finishClosing) controls.enabled = true;
        }
      } else if (inspection === 'cube' && inspectedCube && !reducedMotion.matches) {
        if (!interacting) {
          rotateQuaternionAroundScreenYAxis(
            inspectedCube.quaternion,
            camera.quaternion,
            delta * inspectionAutoRotationSpeed
          );
        }
        inspectedCube.position.y = Math.sin((now - inspectionFloatStartedAt) * Math.PI * 2 / inspectionFloatPeriod)
          * inspectionFloatAmplitude;
      }
      if (!transition) controls.update();
      renderer.render(scene, camera);
    }
    if (finishClosing) {
      frame = requestAnimationFrame(() => {
        if (!disposed && dialog.open) dialog.close();
      });
      return;
    }
    frame = requestAnimationFrame(render);
  };

  const showInspection = (sourceRect: DOMRect) => {
    inspectionFloatStartedAt = performance.now();
    info.hidden = false;
    dialog.style.setProperty('--cube-backdrop-alpha', '62%');
    previewSnapshot.hidden = false;
    previewSnapshot.style.opacity = '1';
    restSnapshot.hidden = true;
    restSnapshot.style.opacity = '0';
    renderer.domElement.style.removeProperty('opacity');
    dialog.showModal();
    expanded.append(renderer.domElement);
    active = true;
    resize();
    camera.updateMatrixWorld();
    const endQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, -0.54, 0));
    if (reducedMotion.matches) {
      inspectedCube!.position.set(0, 0, 0);
      inspectedCube!.scale.setScalar(1);
      inspectedCube!.quaternion.copy(endQuaternion);
      controls.enabled = true;
    } else {
      const startPose = calculateInspectionStartPose(
        camera,
        renderer.domElement.getBoundingClientRect(),
        sourceRect,
        cubeBaseWidth
      );
      inspectedCube!.position.copy(startPose.position);
      inspectedCube!.scale.setScalar(startPose.scale);
      inspectedCube!.quaternion.identity();
      inspectionTransition = {
        startedAt: performance.now(),
        duration: 560,
        startPosition: startPose.position,
        endPosition: new THREE.Vector3(),
        startScale: startPose.scale,
        endScale: 1,
        startQuaternion: inspectedCube!.quaternion.clone(),
        endQuaternion,
        closing: false
      };
      root.dataset.cubeTransitioning = '';
      controls.enabled = false;
    }
    renderer.render(scene, camera);
    lastFrame = performance.now();
    frame = requestAnimationFrame(render);
    dialog.focus({ preventScroll: true });
  };
  const openCube = (event: Event) => {
    if (root.dataset.cubeReady === undefined) return;
    liftReturnTimers.forEach(clearTimeout);
    liftReturnTimers.clear();
    liftStartedAt.clear();
    liftAnimations.forEach((motion) => motion.cancel());
    liftAnimations.clear();
    const button = event.currentTarget as HTMLButtonElement;
    const cubeIndex = Number(button.dataset.cubeIndex);
    inspection = 'cube';
    opener = button;
    dialog.setAttribute('aria-label', `${tools[cubeIndex].name} 方块预览`);
    infoName.textContent = tools[cubeIndex].name;
    infoDescription.textContent = tools[cubeIndex].description;
    inspectedCube = cubes[cubeIndex];
    inspectedRestQuaternion.copy(inspectedCube.quaternion);
    capturePreviewSnapshot(inspectedCube);
    group.visible = true;
    desktopFoam!.visible = false;
    mobileFoam!.visible = false;
    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    group.rotation.set(0, 0, 0);
    cubes.forEach((cube) => { cube.visible = cube === inspectedCube; });
    controls.noZoom = true;
    controls.target.set(0, 0, 0);
    camera.fov = 36;
    camera.position.set(0, narrowScreen.matches ? -1.2 : -0.8, narrowScreen.matches ? 13.5 : 9);
    camera.lookAt(controls.target);
    showInspection(button.getBoundingClientRect());
  };
  const closeInspection = () => {
    if (!active || !inspectedCube || inspectionTransition?.closing) return;
    info.hidden = true;
    pointerGesture = undefined;
    controls.enabled = false;
    interacting = false;
    if (reducedMotion.matches) {
      dialog.close();
      return;
    }

    camera.updateMatrixWorld();
    inspectedCube.updateMatrixWorld(true);
    previewSnapshot.hidden = false;
    previewSnapshot.style.opacity = '1';
    restSnapshot.hidden = false;
    restSnapshot.style.opacity = '0';
    const currentView = camera.matrixWorldInverse.clone();
    const currentModel = inspectedCube.matrixWorld.clone();
    camera.position.set(0, narrowScreen.matches ? -1.2 : -0.8, narrowScreen.matches ? 13.5 : 9);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const rebasedModel = camera.matrixWorld.clone().multiply(currentView).multiply(currentModel);
    rebasedModel.decompose(inspectedCube.position, inspectedCube.quaternion, inspectedCube.scale);
    const targetPose = calculateInspectionStartPose(
      camera,
      renderer.domElement.getBoundingClientRect(),
      opener.getBoundingClientRect(),
      cubeBaseWidth
    );
    inspectionTransition = {
      startedAt: performance.now(),
      duration: 420,
      startPosition: inspectedCube.position.clone(),
      endPosition: targetPose.position,
      startScale: inspectedCube.scale.x,
      endScale: targetPose.scale,
      startQuaternion: inspectedCube.quaternion.clone(),
      endQuaternion: matchQuaternionAcrossCameras(
        inspectedRestQuaternion,
        previewCameraQuaternion,
        camera.quaternion
      ),
      closing: true
    };
    root.dataset.cubeTransitioning = '';
  };
  const restore = () => {
    if (disposed) return;
    active = false;
    cancelAnimationFrame(frame);
    inspectionTransition = undefined;
    delete root.dataset.cubeTransitioning;
    dialog.style.removeProperty('--cube-backdrop-alpha');
    interacting = false;
    controls.enabled = false;
    controls.reset();
    group.visible = true;
    document.querySelector<HTMLElement>('[data-back-button]')?.focus({ preventScroll: true });
    setPreviewPose();
    renderer.domElement.style.removeProperty('opacity');
    preview.append(renderer.domElement);
    resize();
    previewSnapshot.hidden = true;
    previewSnapshot.style.opacity = '0';
    restSnapshot.hidden = true;
    restSnapshot.style.opacity = '0';
    inspection = undefined;
    inspectedCube = undefined;
    pointerGesture = undefined;
  };
  triggers.forEach((button) => button.addEventListener('click', openCube));
  triggers.forEach((button, index) => {
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') liftCube(index, true);
    });
    button.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'touch' && !button.matches(':focus-visible')) liftCube(index, false);
    });
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) liftCube(index, true);
    });
    button.addEventListener('blur', () => {
      if (!button.matches(':hover')) liftCube(index, false);
    });
  });
  const onPointerDown = (event: PointerEvent) => {
    if (!active || inspectionTransition || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!event.isPrimary) {
      pointerGesture = undefined;
      return;
    }
    pointerGesture = {
      pointerId: event.pointerId,
      startedAt: performance.now(),
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
    const distance = Math.hypot(
      event.clientX - pointerGesture.startX,
      event.clientY - pointerGesture.startY
    );
    if (distance > 8) pointerGesture.moved = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
    const gesture = pointerGesture;
    pointerGesture = undefined;
    if (!gesture.moved && performance.now() - gesture.startedAt < 500) closeInspection();
  };
  dialog.addEventListener('pointerdown', onPointerDown, true);
  dialog.addEventListener('pointermove', onPointerMove, true);
  dialog.addEventListener('pointerup', onPointerUp);
  dialog.addEventListener('pointercancel', () => { pointerGesture = undefined; }, true);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeInspection();
  });
  dialog.addEventListener('close', restore);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    if (dialog.open) dialog.close();
    observer.disconnect();
    narrowScreen.removeEventListener('change', onLayoutChange);
    reducedMotion.removeEventListener('change', onReducedMotionChange);
    liftReturnTimers.forEach(clearTimeout);
    liftReturnTimers.clear();
    liftAnimations.forEach((motion) => motion.cancel());
    liftAnimations.clear();
    controls.dispose();
    iconTextures.forEach((texture) => texture.dispose());
    insertTopDetail?.dispose();
    insertSlotDetail?.dispose();
    shellTextures.forEach((texture) => texture.dispose());
    shellPlane.geometry.dispose();
    shellMaterial.dispose();
    iconGeometry.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    cubes.forEach((cube) => cube.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      }
    }));
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    for (const foam of [desktopFoam, mobileFoam]) {
      foam?.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
