/**
 * @module node-opcua-alias-name-common
 *
 * `VersionTime` helpers (OPC 10000-4 clause 7.43, used by OPC 10000-17
 * clause 6.3.1 for the `LastChange` Property of an `AliasNameCategoryType`).
 *
 * `VersionTime` is a **UInt32 count of seconds since 2000-01-01T00:00:00Z**,
 * *not* a `DateTime`. Writing a `DateTime` into `LastChange` is the single most
 * likely implementation mistake here, because every other "last changed"
 * Property in the SDK is a `DateTime` and the name gives no hint.
 */

/** 2000-01-01T00:00:00Z expressed as milliseconds since the JavaScript epoch. */
export const VERSION_TIME_EPOCH_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);

/** One past the largest representable VersionTime; the value wraps here. */
const UINT32_MODULO = 0x1_0000_0000;

/**
 * The instant at which a UInt32 VersionTime wraps back to 0.
 *
 * 2000-01-01T00:00:00Z plus 2**32 seconds, i.e. 2136-02-07T06:28:16Z. A server
 * still running then will report a LastChange that appears to move backwards,
 * which clients read as "drop your cache" (clause 6.3.1). There is nothing in
 * the specification to do about it; it is documented rather than handled.
 */
export const VERSION_TIME_WRAP_DATE = new Date(VERSION_TIME_EPOCH_MS + UINT32_MODULO * 1000);

/**
 * Convert a `Date` to a `VersionTime`.
 *
 * The resolution is one second: sub-second precision is truncated, not rounded,
 * so a VersionTime never names an instant in the future. Values wrap modulo
 * 2**32, matching the UInt32 on the wire.
 *
 * Dates before the epoch are clamped to 0; a negative VersionTime cannot be
 * represented and would otherwise wrap to a very large value, which a client
 * would read as a far-future version.
 */
export function toVersionTime(date: Date | number): number {
    const ms = typeof date === "number" ? date : date.getTime();
    if (!Number.isFinite(ms)) {
        throw new TypeError("toVersionTime: expecting a valid Date");
    }
    const seconds = Math.floor((ms - VERSION_TIME_EPOCH_MS) / 1000);
    if (seconds <= 0) {
        return 0;
    }
    return seconds % UINT32_MODULO;
}

/**
 * Convert a `VersionTime` back to a `Date`.
 *
 * This is the inverse of {@link toVersionTime} only within a single 2**32-second
 * era; the wrapped value alone cannot say which era it belongs to.
 */
export function fromVersionTime(versionTime: number): Date {
    if (!Number.isInteger(versionTime) || versionTime < 0 || versionTime >= UINT32_MODULO) {
        throw new RangeError(`fromVersionTime: ${versionTime} is not a UInt32`);
    }
    return new Date(VERSION_TIME_EPOCH_MS + versionTime * 1000);
}

/** The current time as a `VersionTime`. */
export function nowVersionTime(): number {
    return toVersionTime(Date.now());
}

/**
 * The later of two VersionTimes, used to roll a nested category's change up to
 * its ancestors (clause 6.3.1: a nested `LastChange` "shall always be the latest
 * VersionTime of all Organized AliasNames and AliasNameCategories").
 *
 * This is a plain numeric maximum and therefore does not attempt to reason about
 * wraparound; see {@link VERSION_TIME_WRAP_DATE}.
 */
export function maxVersionTime(a: number, b: number): number {
    return a > b ? a : b;
}
