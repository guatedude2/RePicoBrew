// PicoBrew's vendor API uses -1 as the ABV/IBU sentinel for "not set" (seen throughout the
// PicoPak library sync) — render that as "N/A" instead of a nonsensical negative percentage.
export const formatAbv = (abv: number, { unit = true }: { unit?: boolean } = {}): string =>
  abv < 0 ? 'N/A' : `${abv.toFixed(1)}%${unit ? ' ABV' : ''}`;

export const formatIbu = (ibu: number, { unit = true }: { unit?: boolean } = {}): string =>
  ibu < 0 ? 'N/A' : `${Math.round(ibu)}${unit ? ' IBU' : ''}`;
