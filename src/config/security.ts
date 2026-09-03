export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://giscus.app",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  'frame-src https://giscus.app',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'"
].join('; ');

export const REFERRER_POLICY = 'strict-origin-when-cross-origin';
