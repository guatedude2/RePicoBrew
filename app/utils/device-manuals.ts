import type { DeviceIconKind } from '~/components/settings/DeviceTypeIcon';

// PicoBrew's official product manuals, from https://www.picobrew.com/About/ProductResources/default. Only
// the PDFs on PicoBrew's content storage are listed: that site's own pages (FAQ, videos, member areas) sit
// behind an expired certificate and, on the access point, picobrew.com resolves to this device.
export const MANUAL_SOURCE_BASE = 'https://picobrewcontent.blob.core.windows.net/content';

export type Manual = { slug: string; title: string; file: string };

const m = (slug: string, title: string, file: string): Manual => ({ slug, title, file });

const PICO_S_AND_PRO_TROUBLESHOOTING = m(
  'pico-s-pro-troubleshooting',
  'Troubleshooting',
  'picopro/PICO_S_AND_PRO_TROUBLESHOOTING.pdf',
);

// Keyed by the model icon picked when pairing (Pico S and Pico Pro share a DeviceType but differ here).
const MANUALS_BY_MODEL: Partial<Record<DeviceIconKind, Manual[]>> = {
  picoC: [
    m('pico-c-manual', 'Manual', 'picoc/PicoC_Manual.pdf'),
    m('pico-c-coffee', 'Coffee (cold brew)', 'picoc/PicoC_ColdBrew.pdf'),
    m('pico-c-manual-brew', 'Manual Brew', 'picoc/PicoC_ManualBrew.pdf'),
    m('diy-cleaning-bucket', 'DIY Cleaning Bucket', 'accessory/DIY_CleaningBucket.pdf'),
    m('pico-c-troubleshooting', 'Troubleshooting', 'picoc/PICO_C_TROUBLESHOOTING.pdf'),
  ],
  picoPro: [
    m('pico-pro-manual', 'Manual', 'picopro/PicoPro_Manual.pdf'),
    m('pico-pro-coffee', 'Coffee (cold brew)', 'picopro/PicoPro_ColdBrew.pdf'),
    m('pico-pro-manual-brew', 'Manual Brew', 'picopro/PicoPro_ManualBrew.pdf'),
    PICO_S_AND_PRO_TROUBLESHOOTING,
  ],
  picoS: [m('pico-s-manual', 'Manual', 'pico/Pico_Manual.pdf'), PICO_S_AND_PRO_TROUBLESHOOTING],
  zseries: [
    m('z-quick-start', 'Quick Start', 'z/Z_QuickStart.pdf'),
    m('z-bottling-kit', 'Bottling Kit', 'z/Z_BottlingKit.pdf'),
    m('z-draft-kit', 'Draft Kit', 'z/Z_DraftKit.pdf'),
    m('z-troubleshooting', 'Troubleshooting', 'z/Z_TROUBLESHOOTING.pdf'),
  ],
  zymatic: [
    m('zymatic-manual', 'Manual', 'zymatic/Zymatic_Manual.pdf'),
    m('zymatic-troubleshooting', 'Troubleshooting', 'zymatic/ZYMATIC_TROUBLESHOOTING.pdf'),
  ],
  picoFerm: [
    m('picoferm-manual', 'Manual', 'picoferm/PicoFerm_Manual.pdf'),
    m('picoferm-troubleshooting', 'Troubleshooting', 'picoferm/PICOFERM_TROUBLESHOOTING.pdf'),
  ],
};

export const manualsForModel = (kind: DeviceIconKind): Manual[] => MANUALS_BY_MODEL[kind] ?? [];

export const ALL_MANUALS: Manual[] = [
  ...new Map(Object.values(MANUALS_BY_MODEL).flatMap((list) => (list ?? []).map((item) => [item.slug, item]))).values(),
];

export const findManual = (slug: string): Manual | undefined => ALL_MANUALS.find((item) => item.slug === slug);

export const manualSourceUrl = (manual: Manual) => `${MANUAL_SOURCE_BASE}/${manual.file}`;
