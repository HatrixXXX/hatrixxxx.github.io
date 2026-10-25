import { glob, type Loader } from 'astro/loaders';

// Keep protected Markdown out of Astro's native module and image asset graph.
// Its original body is rendered only by the encrypted-content renderer.
export function protectedGlob(options: Parameters<typeof glob>[0]): Loader {
  const loader = glob({ ...options, deferRender: true, retainBody: true });

  return {
    ...loader,
    name: 'protected-markdown-glob',
    load(context) {
      return loader.load({
        ...context,
        // Invalidate entries cached before native asset registration was disabled.
        generateDigest: (value) => `protected-body-v1:${context.generateDigest(value)}`,
        store: {
          ...context.store,
          set(entry) {
            return context.store.set({
              ...entry,
              rendered: undefined,
              deferredRender: false,
              assetImports: []
            });
          }
        }
      });
    }
  };
}
