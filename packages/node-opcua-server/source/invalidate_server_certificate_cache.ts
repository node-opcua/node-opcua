/**
 * @module node-opcua-server
 */
import { invalidateCachedSecrets } from "node-opcua-common";
import type { OPCUABaseServer } from "./base_server";

/**
 * Invalidate all cached certificates on a running server so that
 * subsequent GetEndpoints / OpenSecureChannel calls reflect the
 * current on-disk certificate.
 *
 * Call this after replacing the server's certificate PEM file.
 * Works with or without push certificate management.
 *
 * ```ts
 * // 1. write new cert to disk (e.g. via CertificateManager)
 * // 2. tell the server to pick it up:
 * invalidateServerCertificateCache(server);
 * ```
 */
export function invalidateServerCertificateCache(server: OPCUABaseServer): void {
    invalidateCachedSecrets(server);
    for (const ep of server.endpoints) {
        ep.invalidateCertificates();
    }
}
