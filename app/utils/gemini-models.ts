// Google retires Gemini models regularly (2.5 Flash is already closed to new users), so nothing here hard-codes a
// model: the best choice is always "the newest full Flash model the key can see".

const versionParts = (id: string) =>
  (id.match(/^gemini-(\d+(?:\.\d+)*)-/)?.[1] ?? '0').split('.').map((n) => Number(n));

const compareVersionsDesc = (a: string, b: string) => {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return a.localeCompare(b);
};

// Newest plain "gemini-<version>-flash", else the newest Flash variant that isn't a Lite one, else the first model.
export function pickGeminiModel(models: string[]): string | null {
  const ids = models.filter((m) => m.startsWith('gemini'));
  const plainFlash = ids.filter((m) => /^gemini-\d+(?:\.\d+)*-flash$/.test(m)).sort(compareVersionsDesc);
  if (plainFlash[0]) {
    return plainFlash[0];
  }
  const anyFlash = ids.filter((m) => /flash/.test(m) && !/lite/.test(m)).sort(compareVersionsDesc);
  return anyFlash[0] ?? ids[0] ?? models[0] ?? null;
}
