/**
 * @module node-opcua-certificate-manager/browser
 *
 * Browser-safe subset of `node-opcua-certificate-manager`. Selected
 * automatically by bundlers via the `"browser"` condition in this package's
 * `exports` map.
 *
 * The real {@link certificate_manager} module imports `node:fs`, `node:path`,
 * `env-paths`, and `node-opcua-pki`. The latter transitively pulls in
 * `chokidar`, `yauzl`, `wget-improved-2`, `proper-lockfile`, `@peculiar/webcrypto`,
 * and other Node-only modules. Browser consumers of `node-opcua-client`
 * (e.g. `createBrowserClient`) never construct an `OPCUACertificateManager`
 * — they pass an `InMemoryCertificateStore` from `node-opcua-common`
 * instead — so we expose only the type-level surface plus stubs that throw
 * if the runtime path is ever hit.
 */

import type { Certificate } from "node-opcua-crypto/web";
import type { StatusCode, StatusCodeCallback } from "node-opcua-status-code";

/**
 * Stub interface mirroring the public methods of the real
 * `OPCUACertificateManager`. The real class extends
 * `CertificateManager` from `node-opcua-pki`; the browser bundle does
 * not load that module, so the stub class below is intentionally a plain
 * class that throws on construction.
 */
export interface ICertificateManager {
    getTrustStatus(certificate: Certificate): Promise<StatusCode>;
    getTrustStatus(certificate: Certificate, callback: StatusCodeCallback): void;
    checkCertificate(certificate: Certificate): Promise<StatusCode>;
    checkCertificate(certificate: Certificate, callback: StatusCodeCallback): void;
    trustCertificate(certificate: Certificate, callback: (err?: Error | null) => void): void;
    trustCertificate(certificate: Certificate): Promise<void>;
    rejectCertificate(certificate: Certificate, callback: (err?: Error | null) => void): void;
    rejectCertificate(certificate: Certificate): Promise<void>;
}

export interface OPCUACertificateManagerOptions {
    rootFolder?: null | string;
    automaticallyAcceptUnknownCertificate?: boolean;
    name?: string;
    keySize?: 2048 | 3072 | 4096;
    disableFileWatchers?: boolean;
}

/**
 * Browser stub for {@link OPCUACertificateManager}. The disk-backed
 * certificate manager is not available in the browser; pass an
 * `InMemoryCertificateStore` from `node-opcua-common` as
 * `clientCertificateManager` instead. Constructing this stub throws so
 * regressions surface immediately.
 */
export class OPCUACertificateManager {
    public static defaultCertificateSubject = "/O=Sterfive/L=Orleans/C=FR";
    public referenceCounter = 0;
    public automaticallyAcceptUnknownCertificate = false;

    constructor(_options?: OPCUACertificateManagerOptions) {
        throw new Error(
            "OPCUACertificateManager is not available in the browser bundle. " +
            "Pass an InMemoryCertificateStore from node-opcua-common as clientCertificateManager instead."
        );
    }
}

/**
 * Browser stub for `getDefaultCertificateManager`. The Node implementation
 * builds an `OPCUACertificateManager` rooted under the OS config directory
 * (env-paths); none of that exists in the browser. Throws if reached —
 * `createBrowserClient` always supplies a `clientCertificateManager`
 * explicitly so this path is unreachable in normal use.
 */
export function getDefaultCertificateManager(_name: "PKI" | "UserPKI"): never {
    throw new Error(
        "getDefaultCertificateManager is not available in the browser bundle. " +
        "Pass clientCertificateManager explicitly when constructing the client."
    );
}

// Deprecated re-export kept for source compatibility with the Node entry.
export { defaultCertificateSubject, makeSubject } from "node-opcua-common";
