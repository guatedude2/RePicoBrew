// Beer-color reference swatches (public/srm/srm_<n>.png), mirrored from PicoBrew's own public
// recipe library (github.com/Justin-Credible/picobrew-recipes — unlicensed/open source, and the
// same images PicoBrew's own site used). Only discrete SRM steps have a swatch; a recipe's exact
// color rounds DOWN to the nearest one available, so e.g. SRM 45 shows the 40 swatch rather than
// jumping up to 50.
const SRM_SWATCH_STEPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  33, 34, 35, 36, 37, 38, 39, 40, 50, 60, 70, 80,
];

// Used as the default recipe photo whenever no photo has been uploaded — overridden the moment a
// user uploads their own, since that always takes priority over this computed default.
export function srmSwatchUrl(colorSRM: number | null | undefined): string | null {
  if (colorSRM == null) {
    return null;
  }
  let step = SRM_SWATCH_STEPS[0];
  for (const candidate of SRM_SWATCH_STEPS) {
    if (candidate > colorSRM) {
      break;
    }
    step = candidate;
  }
  return `/srm/srm_${step}.png`;
}
