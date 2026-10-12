export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' data: https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js https://events.vercount.one",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net https:",
  "font-src 'self' data:",
  "connect-src 'self' https://comments.hatrix.site https://events.vercount.one",
  "media-src 'self' data: blob:",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'"
].join('; ');

export const REFERRER_POLICY = 'strict-origin-when-cross-origin';
