/**
 * @module node-opcua-common
 */
import { EventEmitter } from "node:events";
import { assert } from "node-opcua-assert";
import { type Certificate, type IKeyOperations, type PrivateKey, split_der } from "node-opcua-crypto/web";

import type { ICertificateChainProvider } from "./certificate_chain_provider";
import { DiskCertificateKeyPairProvider } from "./disk_certificate_key_pair_provider";
import { getKeyOperationsFromProvider } from "./local_key_operations_provider";

export interface ICertificateKeyPairProvider {
    getCertificate(): Certificate;
    getCertificateChain(): Certificate[];
    /**
     * The raw private key. Kept for compatibility — new code should prefer
     * {@link ICertificateKeyPairProvider2.getKeyOperations} (via
     * `getKeyOperationsFromProvider`), which works whether the key is local
     * or HSM/KMS-held; an opaque provider implements this method by
     * throwing `PrivateKeyUnavailableError`.
     */
    getPrivateKey(): PrivateKey;
}

/**
 * Extends {@link ICertificateKeyPairProvider} with the key as an opaque
 * sign/decrypt object, so consumers can use the private key without ever
 * holding its material — the seam HSM/KMS-held keys plug into.
 *
 * Same additive pattern as {@link ICertificateKeyPairProviderWithLocation}:
 * the base interface is untouched, existing implementations stay valid, and
 * {@link getKeyOperationsFromProvider} bridges the gap by wrapping
 * `getPrivateKey()` locally when a provider does not implement this.
 */
export interface ICertificateKeyPairProvider2 extends ICertificateKeyPairProvider {
    getKeyOperations(): IKeyOperations;
}

/**
 * Extends {@link ICertificateKeyPairProvider} with diagnostic
 * file-location properties so that consumers can report where
 * certificates are stored (real path or `"<in-memory>"`).
 *
 * Does **not** alter the public `ICertificateKeyPairProvider`
 * interface — zero breaking change to `ServerSecureChannelParent`,
 * `ClientSecureChannelParent`, or any external implementation.
 */
export interface ICertificateKeyPairProviderWithLocation extends ICertificateKeyPairProvider {
    readonly certificateFile: string;
    readonly privateKeyFile: string;
    invalidate?(): void;
}

/**
 * Wrap a bare {@link ICertificateKeyPairProvider} (without location
 * properties) into an {@link ICertificateKeyPairProviderWithLocation}.
 *
 * If the provider already implements the extended interface, it is
 * returned as-is. Otherwise a thin wrapper adds `"<unknown>"` defaults.
 */
function ensureProviderHasLocation(provider: ICertificateKeyPairProvider): ICertificateKeyPairProviderWithLocation {
    if ("certificateFile" in provider && "privateKeyFile" in provider) {
        return provider as ICertificateKeyPairProviderWithLocation;
    }
    return {
        get certificateFile() {
            return "<unknown>";
        },
        get privateKeyFile() {
            return "<unknown>";
        },
        getCertificate: () => provider.getCertificate(),
        getCertificateChain: () => provider.getCertificateChain(),
        getPrivateKey: () => provider.getPrivateKey(),
        invalidate: () => {
            if ("invalidate" in provider && typeof provider.invalidate === "function") {
                provider.invalidate();
            }
        }
    };
}

/**
 * Extract a partial certificate chain from a certificate chain so that the
 * total size of the chain does not exceed maxSize.
 * If maxSize is not provided, the full certificate chain is returned.
 * If the first certificate in the chain already exceeds maxSize, an error is thrown.
 *
 * @param certificateChain - full certificate chain (single DER buffer or array)
 * @param maxSize          - optional byte budget
 * @returns the truncated chain as an array of individual certificates
 */
export function getPartialCertificateChain(certificateChain?: Certificate | Certificate[] | null, maxSize?: number): Certificate[] {
    if (
        !certificateChain ||
        (Array.isArray(certificateChain) && certificateChain.length === 0) ||
        (certificateChain instanceof Buffer && certificateChain.length === 0)
    ) {
        return [];
    }
    const certificates = Array.isArray(certificateChain) ? certificateChain : split_der(certificateChain);
    if (maxSize === undefined) {
        return certificates;
    }
    // at least include first certificate
    const chainToReturn: Certificate[] = [certificates[0]];
    let cumulatedLength = certificates[0].length;
    // Throw if first certificate already exceed maxSize
    if (cumulatedLength > maxSize) {
        throw new Error(`getPartialCertificateChain not enough space for leaf certificate ${maxSize} < ${cumulatedLength}`);
    }
    let index = 1;
    while (index < certificates.length && cumulatedLength + certificates[index].length <= maxSize) {
        chainToReturn.push(certificates[index]);
        cumulatedLength += certificates[index].length;
        index++;
    }
    return chainToReturn;
}

export interface IOPCUASecureObjectOptions {
    certificateFile?: string;
    privateKeyFile?: string;
    /**
     * Optional pre-built certificate + private-key provider. When supplied,
     * `OPCUASecureObject.getCertificate()` / `.getCertificateChain()` /
     * `.getPrivateKey()` delegate to this object verbatim, and the disk-backed
     * path (`fs.existsSync` + `readCertificateChain` + `readPrivateKey`) is
     * not used.
     *
     * Intended for browser builds (bundled via esbuild) and test fixtures that
     * want to stage a cert+key pair without staging PKI folders on disk.
     *
     * When present, `certificateFile` / `privateKeyFile` become optional and
     * may be omitted.
     * When absent, those two fields remain required strings and a
     * {@link DiskCertificateKeyPairProvider} is created automatically.
     */
    certificateKeyPairProvider?: ICertificateKeyPairProvider;
}

/**
 * An object that provides a certificate and a privateKey.
 *
 * All certificate/key access is delegated to an internal
 * {@link ICertificateKeyPairProviderWithLocation} provider.
 *
 * - When constructed with file paths, a {@link DiskCertificateKeyPairProvider}
 *   is created automatically.
 * - When constructed with an injected provider, it is used directly.
 * - The provider can be replaced at runtime via {@link setProvider}.
 */
// biome-ignore lint/suspicious/noExplicitAny: EventEmitter use any
export class OPCUASecureObject<T extends Record<string | symbol, any> = any>
    extends EventEmitter<T>
    implements ICertificateKeyPairProvider
{
    #provider: ICertificateKeyPairProviderWithLocation;

    constructor(options: IOPCUASecureObjectOptions) {
        super();
        if (options.certificateKeyPairProvider) {
            // Injected provider — wrap if missing location properties
            this.#provider = ensureProviderHasLocation(options.certificateKeyPairProvider);
        } else {
            // Auto-create disk provider from file paths
            assert(typeof options.certificateFile === "string", "certificateFile or certificateKeyPairProvider is required");
            assert(typeof options.privateKeyFile === "string", "privateKeyFile or certificateKeyPairProvider is required");
            this.#provider = new DiskCertificateKeyPairProvider(
                options.certificateFile || "invalid certificate file",
                options.privateKeyFile || "invalid private key file"
            );
        }
    }

    /** File path of the certificate (or `"<in-memory>"`). */
    public get certificateFile(): string {
        return this.#provider.certificateFile;
    }

    /** File path of the private key (or `"<in-memory>"`). */
    public get privateKeyFile(): string {
        return this.#provider.privateKeyFile;
    }

    public getCertificate(): Certificate {
        return this.#provider.getCertificate();
    }

    public getCertificateChain(): Certificate[] {
        return this.#provider.getCertificateChain();
    }

    /**
     * The raw private key.
     * @deprecated prefer {@link getKeyOperations}: it works whether the key
     * is local or HSM/KMS-held, while this throws
     * `PrivateKeyUnavailableError` when the installed provider is opaque.
     * Kept for compatibility with code that genuinely needs key material
     * (e.g. push certificate management).
     */
    public getPrivateKey(): PrivateKey {
        return this.#provider.getPrivateKey();
    }

    /**
     * The private key as an opaque sign/decrypt object, whatever the
     * provider: an {@link ICertificateKeyPairProvider2} answers directly
     * (the only usable path when the key is HSM/KMS-held), any other
     * provider gets its raw key wrapped. See {@link getKeyOperationsFromProvider}.
     */
    public getKeyOperations(): IKeyOperations {
        return getKeyOperationsFromProvider(this.#provider);
    }

    /**
     * Replace the internal provider.
     * Accepts any {@link ICertificateKeyPairProvider} — wraps it
     * with location defaults if it lacks `certificateFile`/`privateKeyFile`.
     */
    public setProvider(provider: ICertificateKeyPairProvider): void {
        this.#provider = ensureProviderHasLocation(provider);
    }

    /**
     * Return the current provider, e.g. so a caller can install the exact
     * same provider instance elsewhere (endpoints reusing the server's
     * resolved private-key provider rather than each re-resolving it).
     */
    public getProvider(): ICertificateKeyPairProviderWithLocation {
        return this.#provider;
    }

    /**
     * Same as {@link getProvider}, but guarantees `invalidate()` is present
     * — wrapping with a no-op if the current provider doesn't implement it
     * — for callers, such as `OPCUAServerEndPoint.setCertificateProvider()`,
     * that require the stricter {@link ICertificateChainProvider} shape.
     * Every call delegates live to whatever provider is current *at call
     * time*; it does not track later `setProvider()` swaps.
     */
    public getCertificateChainProvider(): ICertificateChainProvider {
        const provider = this.#provider;
        if (typeof provider.invalidate === "function") {
            return provider as ICertificateChainProvider;
        }
        return {
            getCertificate: () => provider.getCertificate(),
            getCertificateChain: () => provider.getCertificateChain(),
            getPrivateKey: () => provider.getPrivateKey(),
            invalidate: () => {
                /* no-op: underlying provider does not implement invalidate() */
            }
        };
    }

    /**
     * Invalidate cached certificate chain and private key so the next
     * `getCertificate()` / `getPrivateKey()` call re-reads from the
     * underlying source. For in-memory providers, this is a no-op.
     */
    public invalidateCachedCertificates(): void {
        this.#provider.invalidate?.();
    }
}
