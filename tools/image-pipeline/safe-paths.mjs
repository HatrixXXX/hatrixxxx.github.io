import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

function isDescendant(root, path) {
  const pathRelative = relative(root, path);
  return pathRelative !== '' && pathRelative !== '..' && !pathRelative.startsWith(`..${sep}`) &&
    !isAbsolute(pathRelative);
}

export async function assertSafeRoot(root, label) {
  const path = resolve(root);
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`symbolic link is not allowed for ${label}: ${path}`);
  return { path, realPath: await realpath(path) };
}

export async function resolveSafePath(root, relativePath, label, { allowMissing = false } = {}) {
  const { path: rootPath, realPath: realRoot } = await assertSafeRoot(root, `${label} root`);
  const path = resolve(rootPath, relativePath);
  if (!isDescendant(rootPath, path)) throw new Error(`unsafe ${label} path: ${relativePath}`);
  let current = rootPath;
  for (const component of relative(rootPath, path).split(sep)) {
    current = join(current, component);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return path;
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`symbolic link is not allowed in ${label}: ${current}`);
    const realCurrent = await realpath(current);
    if (!isDescendant(realRoot, realCurrent)) {
      throw new Error(`resolved ${label} path escapes root: ${relativePath}`);
    }
  }
  return path;
}

export async function resolveSafeImagePath(imageRoot, repoPath, options) {
  const imageDirectory = resolve(imageRoot, 'img');
  const path = resolve(imageRoot, repoPath);
  if (!isDescendant(imageDirectory, path)) throw new Error(`unsafe image path: ${repoPath}`);
  return resolveSafePath(imageRoot, repoPath, 'image', options);
}
