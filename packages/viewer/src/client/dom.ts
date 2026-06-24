export function fileDomId(filePath: string) {
  return `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
