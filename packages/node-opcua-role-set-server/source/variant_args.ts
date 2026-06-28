/**
 * @module node-opcua-role-set-server
 *
 * Small helpers to read Method input arguments out of a `Variant[]` safely.
 */
import type { UserConfigurationMask } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

/** The string value of an argument, or `null` if absent / not a string. */
export function asString(v: Variant | undefined): string | null {
    return v && typeof v.value === "string" ? v.value : null;
}

/** The boolean value of an argument (missing / non-boolean → `false`). */
export function asBoolean(v: Variant | undefined): boolean {
    return !!v && v.value === true;
}

/** The UserConfigurationMask value of an argument (missing / non-numeric → `0`). */
export function asMask(v: Variant | undefined): UserConfigurationMask {
    return (v && typeof v.value === "number" ? v.value : 0) as UserConfigurationMask;
}
