/**
 * The bridge between the certificate/key-pair provider world and the
 * opaque key-operations world, in its own module so concrete providers can
 * use it without importing `opcua_secure_object` (which imports them).
 *
 * @module node-opcua-common
 */
import { keyOperationsFromPrivateKey } from "node-opcua-crypto";
import type { IKeyOperations, PrivateKey } from "node-opcua-crypto/web";

import type { ICertificateKeyPairProvider, ICertificateKeyPairProvider2 } from "./opcua_secure_object.js";

function providesKeyOperations(provider: ICertificateKeyPairProvider): provider is ICertificateKeyPairProvider2 {
    return typeof (provider as ICertificateKeyPairProvider2).getKeyOperations === "function";
}

/**
 * Per-provider cache of the local wrap, keyed by the exact `PrivateKey`
 * object returned: a provider that keeps returning the same envelope hits
 * the cache, one whose key rotated (e.g. after `invalidate()`) gets a
 * fresh wrap.
 */
const localKeyOperationsCache = new WeakMap<ICertificateKeyPairProvider, { key: PrivateKey; ops: IKeyOperations }>();

/**
 * Wraps `provider`'s raw key in a `LocalKeyOperations` — sync fast path
 * included — cached per provider and refreshed on key rotation. This is
 * the ONE place a local provider's key material crosses into the
 * key-operations world; the built-in providers implement their
 * {@link ICertificateKeyPairProvider2.getKeyOperations} with it.
 */
export function localKeyOperationsOfProvider(provider: ICertificateKeyPairProvider): IKeyOperations {
    const key = provider.getPrivateKey();
    const cached = localKeyOperationsCache.get(provider);
    if (cached && cached.key === key) {
        return cached.ops;
    }
    const ops = keyOperationsFromPrivateKey(key);
    localKeyOperationsCache.set(provider, { key, ops });
    return ops;
}

/**
 * The key of `provider` as an {@link IKeyOperations}, whether or not the
 * provider implements {@link ICertificateKeyPairProvider2}: an implementing
 * provider answers for itself (an opaque provider MUST, since its
 * `getPrivateKey()` throws); any other provider gets the
 * {@link localKeyOperationsOfProvider} wrap.
 */
export function getKeyOperationsFromProvider(provider: ICertificateKeyPairProvider): IKeyOperations {
    if (providesKeyOperations(provider)) {
        return provider.getKeyOperations();
    }
    return localKeyOperationsOfProvider(provider);
}
