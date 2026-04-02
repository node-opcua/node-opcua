/**
 * @module node-opcua-common
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { assert } from "node-opcua-assert";
import { readCertificateChain, readPrivateKey } from "node-opcua-crypto";
import { type Certificate, type PrivateKey, split_der } from "node-opcua-crypto/web";

import type { ICertificateChainProvider } from "./certificate_chain_provider";

export interface ICertificateKeyPairProvider {
    getCertificate(): Certificate;
    getCertificateChain(): Certificate[];
    getPrivateKey(): PrivateKey;
}

export interface IHasCertificateFile {
    readonly certificateFile: string;
    readonly privateKeyFile: string;
}

/**
 * Holds cryptographic secrets (certificate chain and private key) for a
 * certificate/key file pair. Secrets are lazily loaded from disk on first
 * access and kept in truly private `#`-fields so they never appear in
 * `JSON.stringify`, `console.log`, `Object.keys`, or `util.inspect`.
 */
export class SecretHolder implements ICertificateChainProvider {
    #certificateChain: Certificate[] | null = null;
    #privateKey: PrivateKey | null = null;
    #obj: IHasCertificateFile;

    constructor(obj: IHasCertificateFile) {
        this.#obj = obj;
    }

    public getCertificate(): Certificate {
        // Ensure the chain is loaded before accessing [0]
        const chain = this.getCertificateChain();
        return chain[0];
    }

    public getCertificateChain(): Certificate[] {
        if (!this.#certificateChain) {
            const file = this.#obj.certificateFile;
            if (!fs.existsSync(file)) {
                throw new Error(`Certificate file must exist: ${file}`);
            }
            const chain = readCertificateChain(file);
            if (!chain || chain.length === 0) {
                throw new Error(`Invalid certificate chain (length=0) ${file}`);
            }
            this.#certificateChain = chain;
        }
        return this.#certificateChain;
    }

    public getPrivateKey(): PrivateKey {
        if (!this.#privateKey) {
            const file = this.#obj.privateKeyFile;
            if (!fs.existsSync(file)) {
                throw new Error(`Private key file must exist: ${file}`);
            }
            const key = readPrivateKey(file);
            if (key instanceof Buffer) {
                throw new Error(`Invalid private key ${file}. Should not be a buffer`);
            }
            this.#privateKey = key;
        }
        return this.#privateKey;
    }

    /**
     * Clears cached secrets so the GC can reclaim sensitive material.
     * After calling dispose the holder will re-read from disk on next access.
     */
    public dispose(): void {
        this.#certificateChain = null;
        this.#privateKey = null;
    }

    /**
     * Alias for {@link dispose}.
     * Implements `ICertificateChainProvider.invalidate()`.
     */
    public invalidate(): void {
        this.dispose();
    }

    // Prevent secrets from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return { certificateFile: this.#obj.certificateFile, privateKeyFile: this.#obj.privateKeyFile };
    }

    // Prevent secrets from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return `SecretHolder { certificateFile: "${this.#obj.certificateFile}", privateKeyFile: "${this.#obj.privateKeyFile}" }`;
    }
}

/**
 * Module-private WeakMap that associates an ICertificateKeyPairProvider
 * with its SecretHolder. Using a WeakMap means:
 * - The secret holder is invisible from the outside (no enumerable property)
 * - If the owning object is GC'd, the SecretHolder is automatically collected
 */
const secretHolders = new WeakMap<object, SecretHolder>();

function getSecretHolder(obj: ICertificateKeyPairProvider & IHasCertificateFile): SecretHolder {
    let holder = secretHolders.get(obj);
    if (!holder) {
        holder = new SecretHolder(obj);
        secretHolders.set(obj, holder);
    }
    return holder;
}

/**
 * Invalidate any cached certificate chain and private key for the given
 * provider so that the next `getCertificate()` / `getPrivateKey()` call
 * re-reads from disk.
 *
 * This is the public replacement for the old `$$certificateChain = null`
 * / `$$privateKey = null` pattern.
 */
export function invalidateCachedSecrets(obj: ICertificateKeyPairProvider): void {
    const holder = secretHolders.get(obj);
    if (holder) {
        holder.dispose();
    }
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
}

/**
 * An object that provides a certificate and a privateKey.
 * Secrets are loaded lazily and stored in a module-private WeakMap
 * so they never appear on the instance.
 */

// biome-ignore lint/suspicious/noExplicitAny: EventEmitter use any
export class OPCUASecureObject<T extends Record<string | symbol, any> = any>
    extends EventEmitter<T>
    implements ICertificateKeyPairProvider, IHasCertificateFile
{
    public readonly certificateFile: string;
    public readonly privateKeyFile: string;

    constructor(options: IOPCUASecureObjectOptions) {
        super();
        assert(typeof options.certificateFile === "string");
        assert(typeof options.privateKeyFile === "string");
        this.certificateFile = options.certificateFile || "invalid certificate file";
        this.privateKeyFile = options.privateKeyFile || "invalid private key file";
    }

    public getCertificate(): Certificate {
        return getSecretHolder(this).getCertificate();
    }

    public getCertificateChain(): Certificate[] {
        return getSecretHolder(this).getCertificateChain();
    }

    public getPrivateKey(): PrivateKey {
        return getSecretHolder(this).getPrivateKey();
    }
}
