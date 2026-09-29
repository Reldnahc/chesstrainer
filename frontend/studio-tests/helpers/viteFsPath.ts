export function viteFsPath(absolutePath: string): string {
  const normalized = absolutePath.replaceAll("\\", "/");
  return `/@fs${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}
