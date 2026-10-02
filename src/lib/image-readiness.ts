export type ReadinessImage = EventTarget & {
  complete: boolean;
  naturalWidth: number;
  loading: string;
  decode(): Promise<void>;
};

function waitForLoad(image: ReadinessImage, signal: AbortSignal): Promise<boolean> {
  image.loading = 'eager';
  if (signal.aborted) return Promise.resolve(false);
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);

  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal.removeEventListener('abort', onError);
      resolve(value);
    };
    const onLoad = () => finish(image.naturalWidth > 0);
    const onError = () => finish(false);
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onError, { once: true });
  });
}

export async function waitForImages(
  images: ReadinessImage[],
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<'ready' | 'error'> {
  if (parentSignal?.aborted) return 'error';

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onAbort, { once: true });
  const cancelled = new Promise<false>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(false), { once: true });
  });
  let timeout!: ReturnType<typeof setTimeout>;
  const deadline = new Promise<false>((resolve) => {
    timeout = globalThis.setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = Promise.all(images.map(async (image) => {
    if (!(await waitForLoad(image, controller.signal)) || controller.signal.aborted) return false;
    try {
      await image.decode();
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  })).then((results) => results.every(Boolean));

  try {
    const ready = await Promise.race([settled, deadline, cancelled]);
    return ready && !controller.signal.aborted ? 'ready' : 'error';
  } finally {
    globalThis.clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}
