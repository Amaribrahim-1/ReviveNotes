export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isUniqueNameError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
