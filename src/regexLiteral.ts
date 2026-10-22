export function splitRegexLiteral(pattern: string): { source: string; flags: string } | null {
  if (!pattern.startsWith("/")) return null;
  const separator = pattern.lastIndexOf("/");
  if (separator === 0) return null;
  const flags = pattern.slice(separator + 1);
  return /^[a-z]*$/.test(flags) ? { source: pattern.slice(1, separator), flags } : null;
}

export function isValidRegex(pattern: string): boolean {
  try {
    const literal = splitRegexLiteral(pattern);
    new RegExp(literal?.source ?? pattern, literal?.flags ?? "");
    return true;
  } catch {
    return false;
  }
}
