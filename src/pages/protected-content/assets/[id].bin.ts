import { readFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { PostEntry } from '../../../lib/content';
import { deriveContentKeyBytes, encryptEnvelope, importContentKey } from '../../../lib/protected-content/crypto';
import {
  collectProtectedAssets,
  type ProtectedAsset
} from '../../../lib/protected-content/markdown';
import { adminKeyFromEnvironment } from '../../../lib/protected-content/server';

interface AssetRouteProps {
  asset: ProtectedAsset;
  keyBytes: Uint8Array;
}

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection(
    'posts',
    ({ data }: PostEntry) => data.locked && !data.draft
  );
  if (posts.length === 0) return [];

  const keyBytes = await deriveContentKeyBytes(adminKeyFromEnvironment());
  const assets = await collectProtectedAssets(posts, keyBytes);
  return assets.map((asset) => ({ params: { id: asset.id }, props: { asset, keyBytes } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { asset, keyBytes } = props as AssetRouteProps;
  const key = await importContentKey(keyBytes, ['encrypt']);
  const envelope = await encryptEnvelope(await readFile(asset.sourcePath), key, asset.aad);

  return new Response(JSON.stringify(envelope), {
    headers: { 'Content-Type': 'application/octet-stream' }
  });
};
