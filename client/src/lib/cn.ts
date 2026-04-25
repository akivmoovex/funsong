export function cn(
  ...parts: (string | boolean | undefined | null | Record<string, boolean>)[]
): string {
  const out: string[] = []
  for (const p of parts) {
    if (!p) continue
    if (typeof p === 'string') {
      if (p) out.push(p)
      continue
    }
    for (const [k, on] of Object.entries(p)) {
      if (on) out.push(k)
    }
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}
