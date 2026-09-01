import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function executePruneDeletion(
  reviewed,
  resolvedCandidates,
  report,
  { remove = unlink } = {}
) {
  const deleted = [];
  let failedPath = null;

  try {
    for (const { path, absolute } of resolvedCandidates) {
      failedPath = path;
      await remove(absolute);
      deleted.push(path);
    }
  } catch (error) {
    const failed = {
      ...reviewed,
      status: 'failed',
      deleted,
      failedPath,
      error: error instanceof Error ? error.message : String(error)
    };
    try {
      await writeJson(report, failed);
    } catch {
      // Preserve the deletion error when best-effort failure reporting also fails.
    }
    throw error;
  }

  const completed = { ...reviewed, status: 'completed', deleted };
  await writeJson(report, completed);
  return completed;
}
