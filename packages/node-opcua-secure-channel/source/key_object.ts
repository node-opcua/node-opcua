/**
 * @module node-opcua-secure-channel
 */
import type { KeyObject as NodeKeyObject } from "node:crypto";
import type { KeyObject } from "node-opcua-crypto/web";

/**
 * Re-type a `node:crypto` KeyObject as node-opcua-crypto's `KeyObject` (which `PublicKey`
 * aliases). Both describe the very same runtime object; only their declarations diverged.
 *
 * node-opcua-crypto declares its own structural `KeyObject` carrying three fixed `export()`
 * overloads (`pem` -> string | Buffer, `der` -> Buffer, `jwk` -> JsonWebKey). @types/node 26
 * collapsed node's overloads into a single generic signature returning a conditional type,
 * `export<T extends KeyExportOptions = {}>(options?: T): KeyExportResult<T, NonSharedBuffer>`,
 * which for an uninstantiated T resolves to `string | JsonWebKey | NonSharedBuffer` and so is
 * assignable to none of the three. The two declarations are now mutually unassignable, which
 * is a fact about the .d.ts files rather than about the value.
 *
 * Drop this once node-opcua-crypto re-exports `crypto.KeyObject` instead of redeclaring it.
 */
export function toCryptoKeyObject(keyObject: NodeKeyObject): KeyObject {
    return keyObject as unknown as KeyObject;
}
