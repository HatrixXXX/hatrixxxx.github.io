export function applyReferenceMap(text, replacements) {
  return [...replacements.entries()]
    .sort(([a], [b]) => b.length - a.length)
    .reduce((current, [from, to]) => current.split(from).join(to), text);
}

const unquote = (value) => value.replace(/^(['"])(.*)\1$/u, '$2');

export function upsertThumbnail(text, fullUrl, thumbnailUrl) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r\n|\n/u);
  if (lines[0] !== '---') throw new Error('frontmatter start not found');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('frontmatter end not found');
  const image = lines.slice(1, end).findIndex((line) => /^image:\s*$/u.test(line));
  if (image < 0) throw new Error('image mapping not found');
  const imageLine = image + 1;
  let blockEnd = imageLine + 1;
  while (blockEnd < end && (/^\s+/u.test(lines[blockEnd]) || lines[blockEnd] === '')) blockEnd += 1;
  const pathIndices = [];
  for (let index = imageLine + 1; index < blockEnd; index += 1) {
    if (/^\s{2}path:\s*/u.test(lines[index])) pathIndices.push(index);
  }
  if (pathIndices.length !== 1) throw new Error('image.path is ambiguous');
  const pathIndex = pathIndices[0];
  const value = unquote(lines[pathIndex].replace(/^\s{2}path:\s*/u, '').trim());
  if (value !== fullUrl) throw new Error(`image.path mismatch: ${value}`);
  const thumbnailIndex = lines.findIndex((line, index) =>
    index > imageLine && index < blockEnd && /^\s{2}thumbnail:\s*/u.test(line));
  if (thumbnailIndex >= 0) lines[thumbnailIndex] = `  thumbnail: ${thumbnailUrl}`;
  else lines.splice(pathIndex + 1, 0, `  thumbnail: ${thumbnailUrl}`);
  return lines.join(newline);
}
