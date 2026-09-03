import { realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor, type RemarkPlugin } from '@astrojs/markdown-remark';
import { siteMarkdownConfig } from '../../config/markdown';
import { contentRoot } from '../content-root';
import type { PostEntry } from '../content';
import { base64url, utf8 } from './encoding';

export interface ProtectedAsset {
  id: string;
  sourcePath: string;
  mediaType: string;
  aad: string;
  url: string;
}

interface MarkdownNode {
  type: string;
  url?: string;
  value?: string;
  data?: { hProperties?: Record<string, unknown> };
  children?: MarkdownNode[];
}

interface ProtectedImageContext {
  postId: string;
  postPath: string;
  contentRoot: string;
  key: CryptoKey;
  assets: Map<string, ProtectedAsset>;
}

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const RAW_HTML_IMAGE = /<img(?:\s|\/?>)/i;
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function protectedContentError(postId: string, reason: string): Error {
  return new Error(`加锁文章 "${postId}" ${reason}`);
}

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child));
}

async function sourceContext(post: PostEntry): Promise<{ postPath: string; contentRoot: string }> {
  if (!post.filePath) {
    throw protectedContentError(post.id, '缺少源文件路径，无法保护正文图片。');
  }

  const unresolvedPostPath = isAbsolute(post.filePath)
    ? resolve(post.filePath)
    : resolve(process.cwd(), post.filePath);
  let postPath: string;
  try {
    postPath = await realpath(unresolvedPostPath);
  } catch {
    throw protectedContentError(post.id, '的源文件不存在，无法保护正文图片。');
  }

  try {
    const canonicalRoot = await realpath(contentRoot('posts'));
    if (pathIsWithin(canonicalRoot, postPath)) {
      return { postPath, contentRoot: canonicalRoot };
    }
  } catch {
    // A content root that does not exist cannot own the post.
  }

  throw protectedContentError(post.id, '的源文件不在文章内容目录内。');
}

function imagePathFromReference(reference: string, postId: string): string {
  if (URL_SCHEME.test(reference) || reference.startsWith('//')) {
    throw protectedContentError(postId, '包含远程或 data 图片；请改为内容目录内的相对图片。');
  }
  if (isAbsolute(reference) || reference.startsWith('/') || reference.startsWith('\\')) {
    throw protectedContentError(postId, '包含绝对图片路径；请改为内容目录内的相对图片。');
  }

  const pathOnly = reference.split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(pathOnly);
  } catch {
    throw protectedContentError(postId, '包含无效图片路径编码。');
  }
}

async function protectImage(reference: string, context: ProtectedImageContext): Promise<ProtectedAsset> {
  const decodedPath = imagePathFromReference(reference, context.postId);
  const unresolvedSource = resolve(dirname(context.postPath), decodedPath);
  if (!pathIsWithin(context.contentRoot, unresolvedSource)) {
    throw protectedContentError(context.postId, '包含越出文章内容目录的图片路径。');
  }

  let sourcePath: string;
  try {
    sourcePath = await realpath(unresolvedSource);
  } catch {
    throw protectedContentError(context.postId, '引用了不存在的正文图片。');
  }
  if (!pathIsWithin(context.contentRoot, sourcePath)) {
    throw protectedContentError(context.postId, '包含越出文章内容目录的图片路径。');
  }

  const mediaType = MEDIA_TYPES[extname(sourcePath).toLowerCase()];
  if (!mediaType) {
    throw protectedContentError(context.postId, '包含不支持的正文图片格式。');
  }

  const stablePath = relative(context.contentRoot, sourcePath).split(sep).join('/');
  const digest = await crypto.subtle.sign(
    'HMAC',
    context.key,
    new Uint8Array(utf8(`asset:${stablePath}`))
  );
  const id = base64url(new Uint8Array(digest));
  const existing = context.assets.get(id);
  if (existing) {
    if (existing.sourcePath !== sourcePath || existing.mediaType !== mediaType) {
      throw protectedContentError(context.postId, '生成了冲突的正文图片标识。');
    }
    return existing;
  }

  const asset: ProtectedAsset = {
    id,
    sourcePath,
    mediaType,
    aad: `asset:${id}`,
    url: `/protected-content/assets/${id}.bin`
  };
  context.assets.set(id, asset);
  return asset;
}

function protectedImages(context: ProtectedImageContext): RemarkPlugin {
  return () => async (tree: MarkdownNode) => {
    const images: MarkdownNode[] = [];
    const visit = (node: MarkdownNode): void => {
      if (node.type === 'html' && node.value && RAW_HTML_IMAGE.test(node.value)) {
        throw protectedContentError(
          context.postId,
          '包含原始 HTML 图片；请改用 Markdown 相对图片语法。'
        );
      }
      if (node.type === 'image') images.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);

    for (const image of images) {
      if (!image.url) {
        throw protectedContentError(context.postId, '包含空的正文图片路径。');
      }
      const asset = await protectImage(image.url, context);
      image.url = TRANSPARENT_PIXEL;
      image.data = {
        ...image.data,
        hProperties: {
          ...image.data?.hProperties,
          'data-protected-src': asset.url,
          'data-protected-type': asset.mediaType
        }
      };
    }
  };
}

export async function renderProtectedMarkdown(
  post: PostEntry,
  keyBytes: Uint8Array
): Promise<{ html: string; assets: ProtectedAsset[] }> {
  if (post.body === undefined) {
    throw protectedContentError(post.id, '缺少 Markdown 正文。');
  }

  const source = await sourceContext(post);
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assets = new Map<string, ProtectedAsset>();
  const processor = await createMarkdownProcessor({
    ...siteMarkdownConfig,
    remarkPlugins: [protectedImages({ ...source, postId: post.id, key, assets }), ...siteMarkdownConfig.remarkPlugins]
  });
  const rendered = await processor.render(post.body, { fileURL: pathToFileURL(source.postPath) });

  return { html: rendered.code, assets: [...assets.values()] };
}

export async function collectProtectedAssets(
  posts: PostEntry[],
  keyBytes: Uint8Array
): Promise<ProtectedAsset[]> {
  const assets = new Map<string, ProtectedAsset>();

  for (const post of posts) {
    if (post.data.draft || !post.data.locked) continue;
    for (const asset of (await renderProtectedMarkdown(post, keyBytes)).assets) {
      const existing = assets.get(asset.id);
      if (existing && (existing.sourcePath !== asset.sourcePath || existing.mediaType !== asset.mediaType)) {
        throw protectedContentError(post.id, '生成了冲突的正文图片标识。');
      }
      assets.set(asset.id, existing ?? asset);
    }
  }

  return [...assets.values()];
}
