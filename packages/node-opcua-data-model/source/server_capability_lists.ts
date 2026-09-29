/**
 * @module node-opcua-data-model
 */
// Editing the two string lists a Server uses to describe what it supports:
//
// - the Profile and Facet URIs of `Server.ServerCapabilities.ServerProfileArray`
//   (OPC 10000-5 and OPC 10000-7), e.g. "http://opcfoundation.org/UA-Profile/Server/Standard";
// - the ServerCapabilityIdentifiers of OPC 10000-12 Annex D, e.g. "DA", "HD", "GDS",
//   "ALIAS", published through mDNS / LDS registration and
//   `ServerConfiguration.ServerCapabilities`.
//
// Both registries are open-ended, so the checks below reject malformed input rather
// than comparing against a fixed list of known values.

/**
 * The OPC 10000-12 Annex D identifier meaning "no capability information is available".
 *
 * It cannot be used in combination with any other capability identifier.
 */
export const NO_CAPABILITY_IDENTIFIER = "NA";

/**
 * Annex D identifiers are kept short because of the mDNS field length limits. This bound
 * is only a sanity check against a value that is clearly not an identifier.
 */
const MAX_CAPABILITY_IDENTIFIER_LENGTH = 32;
const capabilityIdentifierRegex = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * True when `identifier` has the shape of an OPC 10000-12 Annex D ServerCapabilityIdentifier:
 * a short token of letters, digits, `_` or `-`, with no whitespace and none of the
 * separators an mDNS TXT record uses (`,` and `=`).
 */
export function isValidCapabilityIdentifier(identifier: unknown): identifier is string {
    return (
        typeof identifier === "string" &&
        identifier.length <= MAX_CAPABILITY_IDENTIFIER_LENGTH &&
        capabilityIdentifierRegex.test(identifier)
    );
}

/**
 * True when `profileUri` is a non-empty, syntactically absolute URI without whitespace,
 * as the Profile and Facet URIs of OPC 10000-7 are.
 */
export function isValidProfileUri(profileUri: unknown): profileUri is string {
    // URL.canParse rejects a relative reference or a string without a scheme
    return typeof profileUri === "string" && profileUri.length > 0 && !/\s/.test(profileUri) && URL.canParse(profileUri);
}

function assertValidCapabilityIdentifier(identifier: unknown): asserts identifier is string {
    if (!isValidCapabilityIdentifier(identifier)) {
        throw new Error(
            `Invalid ServerCapabilityIdentifier ${JSON.stringify(identifier)}: expecting a short token ` +
                "of letters, digits, '_' or '-' (OPC 10000-12 Annex D), e.g. \"DA\" or \"GDS\""
        );
    }
}

function assertValidProfileUri(profileUri: unknown): asserts profileUri is string {
    if (!isValidProfileUri(profileUri)) {
        throw new Error(
            `Invalid profile URI ${JSON.stringify(profileUri)}: expecting an absolute URI, ` +
                'e.g. "http://opcfoundation.org/UA-Profile/Server/Standard"'
        );
    }
}

function compareOrdinal(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Replace the content of `list` in place, and report whether it differs from before. */
function replaceContent(list: string[], content: string[]): boolean {
    const changed = list.length !== content.length || list.some((value, index) => value !== content[index]);
    if (changed) {
        list.splice(0, list.length, ...content);
    }
    return changed;
}

function normalizeCapabilities(capabilities: string[], restorePlaceholderWhenEmpty: boolean): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const identifier of capabilities) {
        const key = identifier.toUpperCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(identifier);
        }
    }
    // "NA" means "none": it cannot coexist with a real capability
    const real = unique.filter((identifier) => identifier.toUpperCase() !== NO_CAPABILITY_IDENTIFIER);
    if (real.length === 0) {
        return restorePlaceholderWhenEmpty || unique.length > 0 ? [NO_CAPABILITY_IDENTIFIER] : [];
    }
    return real.sort((a, b) => compareOrdinal(a.toUpperCase(), b.toUpperCase()));
}

function normalizeProfileUris(profileUris: string[]): string[] {
    return [...new Set(profileUris)].sort(compareOrdinal);
}

/**
 * Add a ServerCapabilityIdentifier (OPC 10000-12 Annex D) to a capability list, in place.
 *
 * Identifiers are compared case-insensitively and kept in the case they were given.
 * The list is left deduplicated and sorted, and the `"NA"` placeholder is dropped as
 * soon as a real identifier is present.
 *
 * @returns true when the list was changed.
 * @throws when `identifier` is not shaped like a capability identifier.
 */
export function addCapabilityIdentifier(capabilities: string[], identifier: string): boolean {
    assertValidCapabilityIdentifier(identifier);
    return replaceContent(capabilities, normalizeCapabilities([...capabilities, identifier], false));
}

/**
 * Remove a ServerCapabilityIdentifier (OPC 10000-12 Annex D) from a capability list, in place.
 *
 * The comparison is case-insensitive. When the last real identifier goes, the list
 * becomes `["NA"]` rather than empty. The list is left deduplicated and sorted.
 *
 * @returns true when the list was changed.
 * @throws when `identifier` is not shaped like a capability identifier.
 */
export function removeCapabilityIdentifier(capabilities: string[], identifier: string): boolean {
    assertValidCapabilityIdentifier(identifier);
    const key = identifier.toUpperCase();
    const remaining = capabilities.filter((c) => c.toUpperCase() !== key);
    const removed = remaining.length !== capabilities.length;
    return replaceContent(capabilities, normalizeCapabilities(remaining, removed));
}

/**
 * Add a Profile or Facet URI to a `ServerProfileArray`-style list, in place.
 *
 * The list is left deduplicated and sorted. URIs are compared exactly.
 *
 * @returns true when the list was changed.
 * @throws when `profileUri` is not an absolute URI.
 */
export function addProfileUri(profileUris: string[], profileUri: string): boolean {
    assertValidProfileUri(profileUri);
    return replaceContent(profileUris, normalizeProfileUris([...profileUris, profileUri]));
}

/**
 * Remove a Profile or Facet URI from a `ServerProfileArray`-style list, in place.
 *
 * The list is left deduplicated and sorted. URIs are compared exactly.
 *
 * @returns true when the list was changed.
 * @throws when `profileUri` is not an absolute URI.
 */
export function removeProfileUri(profileUris: string[], profileUri: string): boolean {
    assertValidProfileUri(profileUri);
    return replaceContent(profileUris, normalizeProfileUris(profileUris.filter((uri) => uri !== profileUri)));
}
