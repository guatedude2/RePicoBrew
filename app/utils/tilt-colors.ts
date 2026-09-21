// Tilt hydrometer colors, keyed by the iBeacon UUID each color advertises. Kept free of server imports so
// the standalone Bluetooth scanner (workers/tilt-ble.ts) can use it without loading the database layer.
export const TILT_COLOR_UUIDS: Record<string, string> = {
  a495bb10c5b14b44b5121370f02d74de: 'Red',
  a495bb20c5b14b44b5121370f02d74de: 'Green',
  a495bb30c5b14b44b5121370f02d74de: 'Black',
  a495bb40c5b14b44b5121370f02d74de: 'Purple',
  a495bb50c5b14b44b5121370f02d74de: 'Orange',
  a495bb60c5b14b44b5121370f02d74de: 'Blue',
  a495bb70c5b14b44b5121370f02d74de: 'Yellow',
  a495bb80c5b14b44b5121370f02d74de: 'Pink',
};
