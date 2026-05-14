/**
 * @module node-opcua-client-browser
 *
 * Thin helper that constructs an `OPCUAClient` (from `node-opcua-client`)
 * pre-wired with the browser WebSocket transport factory and, when no
 * credentials are supplied, an in-memory certificate/key pair provider so
 * no disk paths are touched.
 *
 * All other `OPCUAClient` configuration passes through unchanged — callers
 * configure session timeouts, reconnection strategies, security policies,
 * etc. exactly as they would for the Node client.
 *
 * @example
 * ```ts
 * import { createBrowserClient, AttributeIds, MessageSecurityMode, SecurityPolicy } from "node-opcua-client-browser";
 *
 * const client = createBrowserClient({
 *     endpointMustExist: false,
 *     securityMode: MessageSecurityMode.None,
 *     securityPolicy: SecurityPolicy.None,
 * });
 * await client.connect("opc.ws://localhost:4840");
 * const session = await client.createSession();
 * const dv = await session.read({ nodeId: "ns=1;s=Counter", attributeId: AttributeIds.Value });
 * await session.close();
 * await client.disconnect();
 * ```
 */

import { InMemoryCertificateKeyPairProvider, InMemoryCertificateStore } from "node-opcua-common";
import { OPCUAClient, type OPCUAClientOptions } from "node-opcua-client";
import type { Certificate, PrivateKey } from "node-opcua-crypto/web";

import { browserWsTransportFactory } from "./client_ws_transport";

/**
 * Options accepted by {@link createBrowserClient}. Superset of
 * {@link OPCUAClientOptions}; the browser-specific defaults described above
 * apply unless the caller overrides them.
 */
export interface CreateBrowserClientOptions extends OPCUAClientOptions {
    /**
     * Pre-built client certificate chain (DER). When combined with
     * `clientPrivateKey`, it is loaded into an
     * `InMemoryCertificateKeyPairProvider` so the owning `OPCUAClient`
     * needs no disk cert files.
     *
     * If you already pass `certificateKeyPairProvider`, this option is
     * ignored.
     */
    clientCertificate?: Certificate | Certificate[];

    /**
     * Pre-built client private key. Paired with `clientCertificate` to
     * populate the in-memory provider.
     *
     * If you already pass `certificateKeyPairProvider`, this option is
     * ignored.
     */
    clientPrivateKey?: PrivateKey;
}

/**
 * Construct an `OPCUAClient` with browser-appropriate defaults.
 *
 * - `transportFactory` defaults to `browserWsTransportFactory` so the
 *   underlying secure channel opens a WebSocket. Callers can override by
 *   passing a different `transportFactory`.
 * - `certificateKeyPairProvider` defaults to an
 *   `InMemoryCertificateKeyPairProvider`, populated with
 *   `clientCertificate` / `clientPrivateKey` when those are supplied.
 *   When they are NOT supplied, the provider is constructed empty —
 *   callers are expected to await `ensureCertificateExists(...)` on the
 *   returned client's credentials before connecting with a non-None
 *   security policy.
 * - `clientCertificateManager` defaults to an `InMemoryCertificateStore`
 *   (auto-accept unknown peer certs). Callers can override by passing
 *   their own `clientCertificateManager` (e.g. one backed by IndexedDB
 *   or OPFS).
 */
export function createBrowserClient(options: CreateBrowserClientOptions = {} as CreateBrowserClientOptions): OPCUAClient {
    const { clientCertificate, clientPrivateKey, ...clientOptions } = options;

    // Default to the browser WS transport factory unless the caller supplies one.
    if (!clientOptions.transportFactory) {
        clientOptions.transportFactory = browserWsTransportFactory;
    }

    // Default to an in-memory cert/key provider unless the caller supplies one.
    // If the caller provided a client cert + private key, pre-populate the
    // provider so the owning client can reach them without further async setup.
    if (!clientOptions.certificateKeyPairProvider) {
        const chain = clientCertificate
            ? (Array.isArray(clientCertificate) ? clientCertificate : [clientCertificate])
            : undefined;
        clientOptions.certificateKeyPairProvider = new InMemoryCertificateKeyPairProvider(chain, clientPrivateKey);
    }

    // Default to an in-memory trust store unless the caller supplies one.
    if (!clientOptions.clientCertificateManager) {
        clientOptions.clientCertificateManager = new InMemoryCertificateStore({ autoAcceptUnknown: true });
    }

    return OPCUAClient.create(clientOptions);
}
