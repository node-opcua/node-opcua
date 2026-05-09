/**
 * In-memory certificate/key provider with on-demand provisioning.
 *
 * Can be constructed with pre-existing cert+key, or can
 * auto-provision a self-signed certificate entirely in-memory
 * using `node-opcua-crypto/web` — no disk, no openssl.
 *
 * @module node-opcua-common
 */
import {
    type Certificate,
    CertificatePurpose,
    type PrivateKey,
    convertPEMtoDER,
    createSelfSignedCertificate,
    generatePrivateKey,
    makePrivateKeyFromPem,
    privateKeyToPEM
} from "node-opcua-crypto/web";

import type { ICertificateKeyPairProviderWithLocation } from "./opcua_secure_object";

export interface EnsureCertificateExistsParams {
    applicationUri: string;
    subject: string;
    dns: string[];
    ip?: string[];
    validity?: number; // days, default 3650 (10 years)
}

export class InMemoryCertificateKeyPairProvider implements ICertificateKeyPairProviderWithLocation {
    #chain: Certificate[] | null;
    #privateKey: PrivateKey | null;

    constructor(chain?: Certificate[], key?: PrivateKey) {
        this.#chain = chain ?? null;
        this.#privateKey = key ?? null;
    }

    public get certificateFile(): string {
        return "<in-memory>";
    }

    public get privateKeyFile(): string {
        return "<in-memory>";
    }

    public getCertificate(): Certificate {
        if (!this.#chain) {
            throw new Error("InMemoryCertificateKeyPairProvider: no certificate available — call ensureCertificateExists() first");
        }
        return this.#chain[0];
    }

    public getCertificateChain(): Certificate[] {
        if (!this.#chain) {
            throw new Error("InMemoryCertificateKeyPairProvider: no certificate chain available — call ensureCertificateExists() first");
        }
        return this.#chain;
    }

    public getPrivateKey(): PrivateKey {
        if (!this.#privateKey) {
            throw new Error("InMemoryCertificateKeyPairProvider: no private key available — call ensureCertificateExists() first");
        }
        return this.#privateKey;
    }

    /**
     * Clears cached secrets.
     */
    public invalidate(): void {
        /* no-op — in-memory certs don't need reload from disk */
    }

    /**
     * Auto-provision a self-signed certificate + private key
     * entirely in-memory using `node-opcua-crypto/web`.
     *
     * If a cert+key pair was already provided at construction,
     * this is a no-op.
     *
     * No disk, no openssl, no `node:fs`.
     */
    public async ensureCertificateExists(params: EnsureCertificateExistsParams): Promise<void> {
        if (this.#chain && this.#privateKey) {
            return;
        }

        const cryptoKey = await generatePrivateKey(2048);
        const { cert } = await createSelfSignedCertificate({
            privateKey: cryptoKey,
            subject: params.subject,
            applicationUri: params.applicationUri,
            dns: params.dns,
            ip: params.ip,
            validity: params.validity ?? 365 * 10,
            notBefore: new Date(),
            purpose: CertificatePurpose.ForApplication
        });
        this.#chain = [convertPEMtoDER(cert)];
        const { privPem } = await privateKeyToPEM(cryptoKey);
        this.#privateKey = makePrivateKeyFromPem(privPem);
    }

    // Prevent secrets from leaking through JSON serialization
    public toJSON(): Record<string, string> {
        return {
            provider: "InMemoryCertificateKeyPairProvider",
            certificateFile: "<in-memory>",
            privateKeyFile: "<in-memory>"
        };
    }

    // Prevent secrets from leaking through console.log / util.inspect
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return `InMemoryCertificateKeyPairProvider { <in-memory> }`;
    }
}
