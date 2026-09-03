const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';
const FORBIDDEN_TAG =
  /<\s*\/?\s*(?:script|iframe|object|embed|base|meta|link|style|form|input|button|textarea|select|option|svg|math)\b/i;
const FORBIDDEN_ATTRIBUTE = /\s(?:on[a-z0-9_-]+|srcdoc|formaction)\s*=/i;
const UNSAFE_SCHEME =
  /^\s*(?:(?:javascript|vbscript)\s*:|data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml))/i;
const URL_ATTRIBUTE =
  /\b(?:href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/gi;
const RAW_IMAGE =
  /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))[^>]*>/gi;
const REMOTE_URL = /^https?:\/\//i;

type ContentNode = {
  type?: string;
  url?: string;
  value?: string;
  children?: unknown[];
};

type FileLike = { path?: string };

function fail(file: FileLike, reason: string): never {
  throw new Error(`[remark-content-security] ${file.path ?? 'content'}: ${reason}`);
}

function validateRemoteImage(url: string, file: FileLike): void {
  if (REMOTE_URL.test(url) && !url.startsWith(IMMUTABLE_IMAGE_PREFIX)) {
    fail(file, 'unapproved remote image');
  }
}

function validateHtml(value: string, file: FileLike): void {
  if (FORBIDDEN_TAG.test(value)) fail(file, 'forbidden raw HTML tag');
  if (FORBIDDEN_ATTRIBUTE.test(value)) fail(file, 'forbidden raw HTML attribute');

  for (const match of value.matchAll(URL_ATTRIBUTE)) {
    const url = match[1] ?? match[2] ?? match[3] ?? '';
    if (UNSAFE_SCHEME.test(url)) fail(file, 'unsafe URL in raw HTML');
  }
  for (const match of value.matchAll(RAW_IMAGE)) {
    validateRemoteImage(match[1] ?? match[2] ?? match[3] ?? '', file);
  }
}

function visit(node: ContentNode, file: FileLike): void {
  if ((node.type === 'link' || node.type === 'image') && node.url) {
    if (UNSAFE_SCHEME.test(node.url)) fail(file, 'unsafe URL');
    if (node.type === 'image') validateRemoteImage(node.url, file);
  }
  if (node.type === 'html' && node.value) validateHtml(node.value, file);
  for (const child of node.children ?? []) visit(child as ContentNode, file);
}

export default function remarkContentSecurity() {
  return (tree: ContentNode, file: FileLike = {}) => visit(tree, file);
}
