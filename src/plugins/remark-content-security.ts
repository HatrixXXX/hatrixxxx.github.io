import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';
const SITE_URL = new URL('https://hatrix.site');
const FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'source',
  'svg',
  'math'
]);
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction']);

type ContentNode = {
  type?: string;
  url?: string;
  value?: string;
  children?: unknown[];
};

type FileLike = { path?: string };
type HtmlElement = DefaultTreeAdapterTypes.Element | DefaultTreeAdapterTypes.Template;

function fail(file: FileLike, reason: string): never {
  throw new Error(`[remark-content-security] ${file.path ?? 'content'}: ${reason}`);
}

function isUnsafeUrl(url: URL): boolean {
  if (url.protocol === 'javascript:' || url.protocol === 'vbscript:') return true;
  return (
    url.protocol === 'data:' &&
    /^(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)(?:[;,]|$)/i.test(url.pathname)
  );
}

function validateUrl(value: string, file: FileLike, isImage = false): void {
  let url: URL;
  try {
    url = new URL(value, SITE_URL);
  } catch {
    return;
  }

  if (isUnsafeUrl(url)) fail(file, 'unsafe URL');
  if (
    isImage &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.origin !== SITE_URL.origin &&
    !url.href.startsWith(IMMUTABLE_IMAGE_PREFIX)
  ) {
    fail(file, 'unapproved remote image');
  }
}

function isForbiddenAttribute(name: string): boolean {
  return /^on[a-z0-9_-]+$/i.test(name) || name === 'srcdoc' || name === 'formaction';
}

function visitHtmlElement(element: HtmlElement, file: FileLike): void {
  if (FORBIDDEN_TAGS.has(element.tagName)) fail(file, 'forbidden raw HTML tag');

  for (const attribute of element.attrs) {
    if (isForbiddenAttribute(attribute.name)) fail(file, 'forbidden raw HTML attribute');
    if (attribute.name === 'srcset') fail(file, 'raw HTML srcset is not allowed');
    if (URL_ATTRIBUTES.has(attribute.name)) {
      validateUrl(attribute.value, file, element.tagName === 'img' && attribute.name === 'src');
    }
  }

  visitHtmlNodes(element.childNodes, file);
  if ('content' in element) visitHtmlNodes(element.content.childNodes, file);
}

function visitHtmlNodes(nodes: DefaultTreeAdapterTypes.ChildNode[], file: FileLike): void {
  for (const node of nodes) {
    if ('tagName' in node) visitHtmlElement(node, file);
  }
}

function validateHtml(value: string, file: FileLike): void {
  visitHtmlNodes(parseFragment(value).childNodes, file);
}

function visit(node: ContentNode, file: FileLike): void {
  if ((node.type === 'link' || node.type === 'image') && node.url) {
    validateUrl(node.url, file, node.type === 'image');
  }
  if (node.type === 'html' && node.value) validateHtml(node.value, file);
  for (const child of node.children ?? []) visit(child as ContentNode, file);
}

export default function remarkContentSecurity() {
  return (tree: ContentNode, file: FileLike = {}) => visit(tree, file);
}
