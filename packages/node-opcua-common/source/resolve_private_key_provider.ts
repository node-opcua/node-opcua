/**
 * Shared helper used by `OPCUAServer` and `OPCUAClient` (and by push
 * certificate management, after a key rotation) to resolve a possibly
 * passphrase-encrypted private key once, asynchronously, and install it as
 * a {@link ResolvedCertificateKeyPairProvider} — so that every later,
 * synchronous `getPrivateKey()` call on the secure object succeeds without
 * touching disk (or a passphrase prompt) again.
 *
 * @module node-opcua-common
 */
import type { IKeyOperations, PrivateKey } from "node-opcua-crypto/web";

import { OpaqueCertificateKeyPairProvider } from "./opaque_certificate_key_pair_provider";
import type { ICertificateKeyPairProvider } from "./opcua_secure_object";
import { ResolvedCertificateKeyPairProvider } from "./resolved_certificate_key_pair_provider";

/** Minimal shape of an `OPCUACertificateManager` needed to resolve the private key. */
export interface ICertificateManagerWithAsyncPrivateKey {
    getPrivateKey(): Promise<PrivateKey>;
}

/** Shape of a certificate manager whose key is opaque (HSM/KMS-held, `keyOperations` configured). */
export interface ICertificateManagerWithOpaqueKey {
    isPrivateKeyOpaque(): boolean;
    getKeyOperations(): IKeyOperations;
}

function hasOpaqueKey(manager: unknown): manager is ICertificateManagerWithOpaqueKey {
    const candidate = manager as ICertificateManagerWithOpaqueKey;
    return (
        !!manager &&
        typeof candidate.isPrivateKeyOpaque === "function" &&
        typeof candidate.getKeyOperations === "function" &&
        candidate.isPrivateKeyOpaque()
    );
}

/**
 * Minimal structural shape needed from an `OPCUASecureObject` (an
 * `OPCUAServer`, an `OPCUAClient`, or — via `install_push_certificate_management`
 * — a plain object exposing the same public surface) to install a resolved
 * provider. Kept structural (rather than importing the `OPCUASecureObject`
 * class type) so callers that only have a duck-typed view — e.g. push
 * certificate management's `OPCUAServerPartial` — can use it too.
 */
export interface ISecureObjectProviderTarget {
    readonly certificateFile: string;
    readonly privateKeyFile: string;
    setProvider(provider: ICertificateKeyPairProvider): void;
}

function hasAsyncGetPrivateKey(manager: unknown): manager is ICertificateManagerWithAsyncPrivateKey {
    return !!manager && typeof (manager as ICertificateManagerWithAsyncPrivateKey).getPrivateKey === "function";
}

/** Shape exposing the certificate manager's own managed private-key path (`own/private/private_key.pem`). */
interface IHasOwnPrivateKeyPath {
    privateKey: string;
}

function hasOwnPrivateKeyPath(manager: unknown): manager is IHasOwnPrivateKeyPath {
    return !!manager && typeof (manager as IHasOwnPrivateKeyPath).privateKey === "string";
}

/** Shape exposing `OPCUACertificateManager.isPrivateKeyManaged()`. */
interface IHasIsPrivateKeyManaged {
    isPrivateKeyManaged(): boolean;
}

function hasIsPrivateKeyManaged(manager: unknown): manager is IHasIsPrivateKeyManaged {
    return !!manager && typeof (manager as IHasIsPrivateKeyManaged).isPrivateKeyManaged === "function";
}

/**
 * Resolve the private key via `certificateManager.getPrivateKey()`
 * (decrypting with the manager's configured `privateKeyPassphrase` /
 * `privateKeyProvider` if needed) and install it as `secureObject`'s
 * provider.
 *
 * When the certificate manager reports an OPAQUE key
 * (`isPrivateKeyOpaque()` true — `keyOperations` configured, HSM/KMS-held),
 * an {@link OpaqueCertificateKeyPairProvider} is installed instead, with the
 * key metadata (and public half, when available) prefetched here so later
 * synchronous consumers never await the ops provider for facts.
 *
 * No-ops — leaves the current provider untouched — when:
 * - `hasUserProvidedProvider` is `true` (the secure object was constructed
 *   with a user-supplied `certificateKeyPairProvider` — the existing
 *   escape hatch; the caller owns key resolution entirely), or
 * - the secure object is in-memory (`certificateFile` is `"<in-memory>"` /
 *   `"<unknown>"`), or
 * - `certificateManager` does not expose an async `getPrivateKey()` (e.g. a
 *   bare `ICertificateStore` rather than a full `OPCUACertificateManager`), or
 * - `certificateManager` exposes `isPrivateKeyManaged()` and it returns
 *   `false` — no `privateKeyPassphrase` / `privateKeyProvider` configured,
 *   so the on-disk key is always plaintext and a plain
 *   `DiskCertificateKeyPairProvider` already handles it correctly (crucially,
 *   including re-reading a manually replaced key after `invalidate()` — a
 *   {@link ResolvedCertificateKeyPairProvider} deliberately does not do
 *   that, see its doc — so swapping to one when there is nothing to decrypt
 *   would be a regression, not just unnecessary work), or
 * - `secureObject.privateKeyFile` is not the certificate manager's own
 *   managed key path (`certificateManager.privateKey`, i.e.
 *   `own/private/private_key.pem`). `getPrivateKey()` only ever resolves
 *   *that* file — a caller that overrode `privateKeyFile` to point elsewhere
 *   (a key entirely outside the PKI folder) is opting out of
 *   certificate-manager-managed key handling, and that external file is
 *   read as plaintext exactly as before.
 *
 * Propagates `PrivateKeyPassphraseRequiredError` (from `node-opcua-crypto`)
 * unchanged when the on-disk key is encrypted and no, or the wrong,
 * passphrase is configured on the certificate manager. Callers typically
 * catch this to raise a more actionable, product-specific error message.
 *
 * @returns `true` if a resolved provider was installed, `false` if this
 * call no-op'd for any of the reasons above — callers that need *some* form
 * of refresh either way (e.g. after a certificate rotation) can fall back to
 * a plain `invalidate()` when this returns `false`.
 */
export async function resolvePrivateKeyProviderIfNeeded(
    secureObject: ISecureObjectProviderTarget,
    certificateManager: unknown,
    hasUserProvidedProvider: boolean
): Promise<boolean> {
    if (hasUserProvidedProvider) {
        return false;
    }
    const certificateFile = secureObject.certificateFile;
    if (certificateFile === "<in-memory>" || certificateFile === "<unknown>") {
        return false;
    }
    if (hasOpaqueKey(certificateManager)) {
        // the key is HSM/KMS-held: getPrivateKey() would throw, so install an
        // opaque provider instead — prefetching the key facts (and the public
        // half, when available) once here, asynchronously, so every later
        // synchronous consumer reads them from the provider. This is also the
        // fail-early probe: an unreachable ops provider rejects now.
        const keyOperations = certificateManager.getKeyOperations();
        const keyMetadata = await keyOperations.getKeyMetadata();
        const publicKey = keyOperations.getPublicKey ? await keyOperations.getPublicKey() : undefined;
        secureObject.setProvider(new OpaqueCertificateKeyPairProvider({ certificateFile, keyOperations, keyMetadata, publicKey }));
        return true;
    }
    if (!hasAsyncGetPrivateKey(certificateManager)) {
        return false;
    }
    if (hasIsPrivateKeyManaged(certificateManager) && !certificateManager.isPrivateKeyManaged()) {
        return false;
    }
    if (hasOwnPrivateKeyPath(certificateManager) && certificateManager.privateKey !== secureObject.privateKeyFile) {
        return false;
    }
    const privateKey = await certificateManager.getPrivateKey();
    secureObject.setProvider(new ResolvedCertificateKeyPairProvider(certificateFile, secureObject.privateKeyFile, privateKey));
    return true;
}
