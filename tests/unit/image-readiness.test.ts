import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForImages, type ReadinessImage } from '../../src/lib/image-readiness';

// Resolve the Astro alias to the real module without mocking readiness behavior.
vi.mock('@/lib/image-readiness', async () => import('../../src/lib/image-readiness'));

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  loading = 'lazy';
  decode = vi.fn(async (): Promise<void> => undefined);
}

describe('image readiness', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for every successful image and decode', async () => {
    const first = new FakeImage();
    const second = new FakeImage();
    const result = waitForImages([first, second] as ReadinessImage[], 8_000);
    first.complete = true;
    first.naturalWidth = 100;
    first.dispatchEvent(new Event('load'));
    second.complete = true;
    second.naturalWidth = 100;
    second.dispatchEvent(new Event('load'));
    await expect(result).resolves.toBe('ready');
    expect(first.loading).toBe('eager');
    expect(second.loading).toBe('eager');
    expect(first.decode).toHaveBeenCalledOnce();
    expect(second.decode).toHaveBeenCalledOnce();
  });

  it('returns error for a failed image', async () => {
    const image = new FakeImage();
    const result = waitForImages([image] as ReadinessImage[], 8_000);
    image.dispatchEvent(new Event('error'));
    await expect(result).resolves.toBe('error');
  });

  it('returns error at the eight-second deadline', async () => {
    vi.useFakeTimers();
    const image = new FakeImage();
    const result = waitForImages([image] as ReadinessImage[], 8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(result).resolves.toBe('error');
  });

  it('decodes an already loaded image', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    await expect(waitForImages([image], 8_000)).resolves.toBe('ready');
    expect(image.decode).toHaveBeenCalledOnce();
  });

  it('rejects a cached broken image without decoding it', async () => {
    const image = new FakeImage();
    image.complete = true;
    await expect(waitForImages([image], 8_000)).resolves.toBe('error');
    expect(image.decode).not.toHaveBeenCalled();
  });

  it('stays pending until every decode resolves', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    let finishDecode!: () => void;
    image.decode.mockImplementation(() => new Promise<void>((resolve) => { finishDecode = resolve; }));
    const settled = vi.fn();
    const result = waitForImages([image], 8_000).then(settled);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finishDecode();
    await result;
    expect(settled).toHaveBeenCalledWith('ready');
  });

  it('returns error when decoding rejects', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    image.decode.mockRejectedValue(new Error('decode failed'));
    await expect(waitForImages([image], 8_000)).resolves.toBe('error');
  });

  it('times out an image whose decode never resolves', async () => {
    vi.useFakeTimers();
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    image.decode.mockImplementation(() => new Promise<void>(() => {}));
    const result = waitForImages([image], 8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(result).resolves.toBe('error');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels while an image is decoding', async () => {
    vi.useFakeTimers();
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    image.decode.mockImplementation(() => new Promise<void>(() => {}));
    const controller = new AbortController();
    const result = waitForImages([image], 8_000, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(result).resolves.toBe('error');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns error immediately for an already aborted signal', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    await expect(waitForImages([new FakeImage()], 8_000, controller.signal)).resolves.toBe('error');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels loading and removes image listeners', async () => {
    const image = new FakeImage();
    const removeListener = vi.spyOn(image, 'removeEventListener');
    const controller = new AbortController();
    const result = waitForImages([image], 8_000, controller.signal);
    controller.abort();
    await expect(result).resolves.toBe('error');
    expect(removeListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    image.naturalWidth = 100;
    image.dispatchEvent(new Event('load'));
    expect(image.decode).not.toHaveBeenCalled();
  });
});

describe('character preparation terminal errors', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function preparationFixture(state: string, image: FakeImage) {
    const documentTarget = new EventTarget();
    const dispatch = vi.spyOn(documentTarget, 'dispatchEvent');
    vi.stubGlobal('document', documentTarget);
    vi.stubGlobal('window', new EventTarget());
    const { prepareCharacter } = await import('../../src/scripts/character-idle');
    const rig = {
      dataset: { characterState: state },
      querySelectorAll: vi.fn(() => [image]),
    };
    return { prepareCharacter, rig, dispatch };
  }

  it('keeps an error present before preparation without restarting image readiness', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    const { prepareCharacter, rig, dispatch } = await preparationFixture('error', image);

    await prepareCharacter(rig as unknown as HTMLElement, new AbortController().signal);

    expect(rig.dataset.characterState).toBe('error');
    expect(rig.querySelectorAll).not.toHaveBeenCalled();
    expect(image.decode).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps an error assigned while image decoding is pending', async () => {
    const image = new FakeImage();
    image.complete = true;
    image.naturalWidth = 100;
    let finishDecode!: () => void;
    image.decode.mockImplementation(() => new Promise<void>((resolve) => { finishDecode = resolve; }));
    const { prepareCharacter, rig, dispatch } = await preparationFixture('loading', image);
    const pending = prepareCharacter(rig as unknown as HTMLElement, new AbortController().signal);
    await Promise.resolve();
    expect(image.decode).toHaveBeenCalledOnce();

    rig.dataset.characterState = 'error';
    finishDecode();
    await pending;

    expect(rig.dataset.characterState).toBe('error');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
