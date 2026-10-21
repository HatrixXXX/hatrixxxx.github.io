export function previewDescription(description: string): string {
  const characters = Array.from(description.trim());
  return characters.length <= 100 ? characters.join('') : `${characters.slice(0, 99).join('')}…`;
}
