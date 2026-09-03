import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import {
  dangerousBrowserUrlKind,
  isApprovedRemoteImageUrl,
  resolveBrowserUrl,
  SITE_ORIGIN
} from '../lib/safe-url';

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
const IMAGE_FETCH_ATTRIBUTES = new Set(['poster', 'background']);
const SAFE_INLINE_STYLE = /^\s*zoom\s*:\s*[1-9]\d*%\s*;?\s*$/;

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

function validateUrl(value: string, file: FileLike, isImage = false): void {
  const url = resolveBrowserUrl(value, SITE_ORIGIN);
  if (!url) return;

  if (dangerousBrowserUrlKind(url, SITE_ORIGIN)) fail(file, 'unsafe URL');
  if (
    isImage &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.origin !== SITE_ORIGIN &&
    !isApprovedRemoteImageUrl(url)
  ) {
    fail(file, 'unapproved remote image');
  }
}

function isForbiddenAttribute(name: string): boolean {
  return /^on[a-z0-9_-]+$/i.test(name) || name === 'srcdoc' || name === 'formaction';
}

function isImageFetchAttribute(tagName: string, name: string): boolean {
  return (tagName === 'img' && name === 'src') || IMAGE_FETCH_ATTRIBUTES.has(name);
}

function visitHtmlElement(element: HtmlElement, file: FileLike): void {
  if (FORBIDDEN_TAGS.has(element.tagName)) fail(file, 'forbidden raw HTML tag');

  for (const attribute of element.attrs) {
    if (isForbiddenAttribute(attribute.name)) fail(file, 'forbidden raw HTML attribute');
    if (attribute.name === 'srcset') fail(file, 'raw HTML srcset is not allowed');
    if (attribute.name === 'style' && !SAFE_INLINE_STYLE.test(attribute.value)) {
      fail(file, 'unsafe inline style');
    }
    if (URL_ATTRIBUTES.has(attribute.name)) {
      validateUrl(attribute.value, file, isImageFetchAttribute(element.tagName, attribute.name));
    }
    if (IMAGE_FETCH_ATTRIBUTES.has(attribute.name)) {
      validateUrl(attribute.value, file, true);
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
  visitHtmlNodes(parseFragment(value, { scriptingEnabled: false }).childNodes, file);
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
