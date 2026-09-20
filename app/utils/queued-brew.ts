// A "queued brew" is a normal brew session, created from the app's New Session page, that's waiting
// for the user to pick it up on the Pico itself. It's an ordinary READY session whose status text is
// this marker; the Pico's recipe list shows just that recipe (see api.pico.getAssociatedPaks.ts), and
// picking it makes the device's getRecipe call continue this session instead of creating a new one.
export const QUEUED_STATUS_TEXT = 'Queued for device';

// A queued brew nobody picked up is ignored (and replaced by the next one) after this long, so a
// forgotten one can't sit on the device's recipe list forever.
export const QUEUE_EXPIRY_MS = 6 * 60 * 60 * 1000;

// With nothing queued, a Pico still gets a list to start from on the device — capped, because the
// reply is unpaginated and a big recipe library would otherwise be far too large for the device.
export const DEVICE_RECIPE_LIST_LIMIT = 20;
