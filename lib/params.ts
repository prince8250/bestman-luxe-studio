// The first value of a URL search parameter, trimmed ("" when missing).
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
