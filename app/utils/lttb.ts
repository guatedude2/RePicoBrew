// Largest-Triangle-Three-Buckets downsampling (Steinarsson, 2013): picks `threshold` points that best preserve the
// visual shape of a series (peaks and dips survive, unlike plain every-Nth sampling). Returns the kept indices.
export function lttbIndices(xs: number[], ys: number[], threshold: number): number[] {
  const n = xs.length;
  if (threshold >= n || threshold < 3) {
    return xs.map((_, i) => i);
  }
  const kept = [0];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const nextStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += xs[j];
      avgY += ys[j];
    }
    const count = Math.max(1, nextEnd - nextStart);
    avgX /= count;
    avgY /= count;

    const start = Math.floor(i * bucketSize) + 1;
    const end = Math.floor((i + 1) * bucketSize) + 1;
    let best = start;
    let bestArea = -1;
    for (let j = start; j < end; j++) {
      const area = Math.abs((xs[a] - avgX) * (ys[j] - ys[a]) - (xs[a] - xs[j]) * (avgY - ys[a]));
      if (area > bestArea) {
        bestArea = area;
        best = j;
      }
    }
    kept.push(best);
    a = best;
  }
  kept.push(n - 1);
  return kept;
}
