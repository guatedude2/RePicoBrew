// React Router v7's turbo-stream transport preserves rich types (Date, undefined, Map, Set, ...)
// across the loader -> client boundary, unlike Remix's old `json()` helper which JSON-serialized
// everything (turning Dates into ISO strings). A few loaders return raw Prisma records straight
// through to components/helpers that assume ISO date strings — this restores that exact shape for
// just those loaders instead of teaching every consumer to handle Date objects. The mapped type
// mirrors the runtime JSON round-trip so `Date` fields type-check as `string` too, not just at runtime.
type SerializeDates<T> = T extends Date
  ? string
  : T extends Array<infer U>
  ? Array<SerializeDates<U>>
  : T extends object
  ? { [K in keyof T]: SerializeDates<T[K]> }
  : T;

export function serializeDates<T>(value: T): SerializeDates<T> {
  return JSON.parse(JSON.stringify(value));
}
