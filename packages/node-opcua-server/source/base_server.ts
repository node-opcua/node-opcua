/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import fs from "node:fs";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { withLock } from "@ster5/global-mutex";

import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { getDefaultCertificateManager, type OPCUACertificateManager } from "node-opcua-certificate-manager";
import { performCertificateSanityCheck } from "node-opcua-client";
import { type ICertificateStore, type IOPCUASecureObjectOptions, makeApplicationUrn, makeSubject, OPCUASecureObject } from "node-opcua-common";
import { exploreCertificate } from "node-opcua-crypto/web";
import { coerceLocalizedText } from "node-opcua-data-model";
import { installPeriodicClockAdjustment, uninstallPeriodicClockAdjustment } from "node-opcua-date-time";
import { checkDebugFlag, displayTraceFromThisProjectOnly, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import {
    extractFullyQualifiedDomainName,
    getFullyQualifiedDomainName,
    getHostname,
    getIpAddresses,
    ipv4ToHex,
    resolveFullyQualifiedDomainName
} from "node-opcua-hostname";
import type { Message, Request, Response, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { FindServersRequest, FindServersResponse } from "node-opcua-service-discovery";
import { ApplicationDescription, ApplicationType, GetEndpointsResponse } from "node-opcua-service-endpoints";
import { ServiceFault } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { ApplicationDescriptionOptions, EndpointDescription, GetEndpointsRequest } from "node-opcua-types";
import { checkFileExistsAndIsNotEmpty, matchUri } from "node-opcua-utils";
import type { IChannelData } from "./i_channel_data";
import type { ISocketData } from "./i_socket_data";
import type { OPCUAServerEndPoint } from "./server_end_point";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

const default_server_info = {
    // The globally unique identifier for the application instance. This URI is used as
    // ServerUri in Services if the application is a Server.
    applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server"),

    // The globally unique identifier for the product.
    productUri: "NodeOPCUA-Server",

    // A localized descriptive name for the application.
    applicationName: { text: "NodeOPCUA", locale: "en" },
    applicationType: ApplicationType.Server,
    gatewayServerUri: "",

    discoveryProfileUri: "",

    discoveryUrls: []
};

function cleanupEndpoint(endpoint: OPCUAServerEndPoint) {
    if (endpoint._on_new_channel) {
        assert(typeof endpoint._on_new_channel === "function");
        endpoint.removeListener("newChannel", endpoint._on_new_channel);
        endpoint._on_new_channel = undefined;
    }

    if (endpoint._on_close_channel) {
        assert(typeof endpoint._on_close_channel === "function");
        endpoint.removeListener("closeChannel", endpoint._on_close_channel);
        endpoint._on_close_channel = undefined;
    }
    if (endpoint._on_connectionRefused) {
        assert(typeof endpoint._on_connectionRefused === "function");
        endpoint.removeListener("connectionRefused", endpoint._on_connectionRefused);
        endpoint._on_connectionRefused = undefined;
    }
    if (endpoint._on_openSecureChannelFailure) {
        assert(typeof endpoint._on_openSecureChannelFailure === "function");
        endpoint.removeListener("openSecureChannelFailure", endpoint._on_openSecureChannelFailure);
        endpoint._on_openSecureChannelFailure = undefined;
    }
    if (endpoint._on_channel_secured) {
        assert(typeof endpoint._on_channel_secured === "function");
        endpoint.removeListener("channelSecured", endpoint._on_channel_secured);
        endpoint._on_channel_secured = undefined;
    }
}

/**
 *
 */
export interface OPCUABaseServerOptions extends IOPCUASecureObjectOptions {
    /**
     * the information used in the end point description
     */
    serverInfo?: ApplicationDescriptionOptions;
    /**
     * the server Certificate Manager
     */
    serverCertificateManager?: OPCUACertificateManager | ICertificateStore;
}

const emptyCallback = () => {
    /* empty */
};

export interface OPCUABaseServerEvents {
    request: [request: Request, channel: ServerSecureChannelLayer];
    response: [response: Response, channel: ServerSecureChannelLayer];
    newChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    channelSecured: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    closeChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    connectionRefused: [socketData: ISocketData, endpoint: OPCUAServerEndPoint];
    openSecureChannelFailure: [socketData: ISocketData, channelData: IChannelData, endpoint: OPCUAServerEndPoint];
}

// biome-ignore lint/suspicious/noExplicitAny: must propagate EventEmitter generic
export class OPCUABaseServer<T extends OPCUABaseServerEvents = any> extends OPCUASecureObject<T> {
    public static makeServiceFault = makeServiceFault;

    /**
     * The type of server
     */
    get serverType(): ApplicationType {
        return this.serverInfo.applicationType;
    }

    public serverInfo: ApplicationDescription;
    public endpoints: OPCUAServerEndPoint[];
    public readonly serverCertificateManager: ICertificateStore;
    public capabilitiesForMDNS: string[];
    protected _preInitTask: (() => Promise<void>)[];

    protected options: OPCUABaseServerOptions;

    constructor(options?: OPCUABaseServerOptions) {
        options = options || ({} as OPCUABaseServerOptions);

        if (!options.serverCertificateManager) {
            options.serverCertificateManager = getDefaultCertificateManager("PKI");
        }

        if ("rootDir" in options.serverCertificateManager) {
            // Disk path — derive cert/key paths from certificate manager
            const cm = options.serverCertificateManager as OPCUACertificateManager;
            options.privateKeyFile = options.privateKeyFile || cm.privateKey;
            options.certificateFile =
                options.certificateFile || path.join(cm.rootDir, "own/certs/certificate.pem");
        }
        // else: in-memory path — caller must provide cert/key via provider

        super(options);

        this.serverCertificateManager = options.serverCertificateManager;
        this.capabilitiesForMDNS = [];
        this.endpoints = [];
        this.options = options;
        this._preInitTask = [];

        const serverInfo: ApplicationDescriptionOptions = {
            ...default_server_info,
            ...options.serverInfo
        };
        serverInfo.applicationName = coerceLocalizedText(serverInfo.applicationName);
        this.serverInfo = new ApplicationDescription(serverInfo);

        if (this.serverInfo.applicationName.toString().match(/urn:/)) {
            errorLog("[NODE-OPCUA-E06] application name cannot be a urn", this.serverInfo.applicationName.toString());
        }

        this.serverInfo.applicationName.locale = this.serverInfo.applicationName.locale || "en";

        if (!this.serverInfo.applicationName.locale) {
            warningLog(
                "[NODE-OPCUA-W24] the server applicationName must have a valid locale : ",
                this.serverInfo.applicationName.toString()
            );
        }

        const __applicationUri = serverInfo.applicationUri || "";

        Object.defineProperty(this.serverInfo, "applicationUri", {
            get: () => resolveFullyQualifiedDomainName(__applicationUri),
            configurable: true
        });

        this._preInitTask.push(async () => {
            await extractFullyQualifiedDomainName();
        });

        this._preInitTask.push(async () => {
            await this.initializeCM();
        });
    }

    /**
     * Return additional DNS hostnames to include in the self-signed
     * certificate's SubjectAlternativeName (SAN).
     *
     * The base implementation returns an empty array. Subclasses
     * (e.g. `OPCUAServer`) override this to include hostnames from
     * `alternateHostname` and `advertisedEndpoints`.
     *
     * @internal
     */
    protected getConfiguredHostnames(): string[] {
        return [];
    }

    /**
     * Return additional IP addresses to include in the self-signed
     * certificate's SubjectAlternativeName (SAN) iPAddress entries.
     *
     * The base implementation returns an empty array. Subclasses
     * (e.g. `OPCUAServer`) override this to include IP literals
     * found in `alternateHostname` and `advertisedEndpoints`.
     *
     * These IPs are considered **explicitly configured** by the
     * user and are therefore checked by `checkCertificateSAN()`.
     * In contrast, auto-detected IPs from `getIpAddresses()` are
     * included in the certificate at creation time but are NOT
     * checked later — see `checkCertificateSAN()` for rationale.
     *
     * @internal
     */
    protected getConfiguredIPs(): string[] {
        return [];
    }

    public async createDefaultCertificate(): Promise<void> {
        if (this.certificateFile === "<in-memory>" || this.certificateFile === "<unknown>") {
            // In-memory provider — skip disk operations
            return;
        }
        if (fs.existsSync(this.certificateFile)) {
            return;
        }

        if (!checkFileExistsAndIsNotEmpty(this.certificateFile)) {
            await withLock({ fileToLock: `${this.certificateFile}.mutex` }, async () => {
                if (checkFileExistsAndIsNotEmpty(this.certificateFile)) {
                    return;
                }
                const applicationUri = this.serverInfo.applicationUri || "<missing application uri>";
                const fqdn = getFullyQualifiedDomainName();
                const hostname = getHostname();
                const dns = [...new Set([fqdn, hostname, ...this.getConfiguredHostnames()])].sort();

                // Include both auto-detected IPs and explicitly configured IPs.
                // Auto-detected IPs (getIpAddresses) are ephemeral — they depend on
                // the current network state (WiFi, tethering, VPN, roaming) and may
                // change between reboots. They are included here so that the initial
                // certificate covers the current network configuration, but they are
                // NOT checked by checkCertificateSAN() to avoid noisy warnings when
                // the network changes. Only explicitly configured IPs (from
                // alternateHostname / advertisedEndpoints) are checked at startup.
                const ip = [...new Set([...getIpAddresses(), ...this.getConfiguredIPs()])].sort();

                // Cast is safe: in the disk path, serverCertificateManager is
                // always an OPCUACertificateManager.
                const cm = this.serverCertificateManager as unknown as OPCUACertificateManager;
                await cm.createSelfSignedCertificate({
                    applicationUri,
                    dns,
                    ip,
                    outputFile: this.certificateFile,

                    subject: makeSubject(this.serverInfo.applicationName.text || "<missing application name>", hostname),

                    startDate: new Date(),
                    validity: 365 * 10 // 10 years
                });
            });
        }
    }

    public async initializeCM(): Promise<void> {
        await this.serverCertificateManager.initialize();
        await this.createDefaultCertificate();
        if ("privateKey" in this.serverCertificateManager) {
            debugLog("privateKey      = ", this.privateKeyFile, (this.serverCertificateManager as unknown as { privateKey: string }).privateKey);
        } else {
            debugLog("privateKey      = ", this.privateKeyFile);
        }
        debugLog("certificateFile = ", this.certificateFile);
        this._checkCertificateSanMismatch();
        await performCertificateSanityCheck(this, "server", this.serverCertificateManager, this.serverInfo.applicationUri || "");
        this._checkOwnCertificateChainCompleteness();
    }

    /**
     * Check that the server's certificate PEM contains the full
     * chain (leaf + issuer CAs).  If the certificate is CA-signed
     * but the PEM only contains the leaf, a prominent warning is
     * logged so the operator can detect the mismatch easily.
     *
     * This method intentionally does NOT attempt to auto-heal the
     * certificate file — the provisioning layer (GDS UpdateCertificate,
     * CLI tools, etc.) is responsible for writing the full chain.
     * Use {@link CertificateManager.completeCertificateChain} in
     * provisioning code to reconstruct a partial chain.
     *
     * @internal
     */
    private _checkOwnCertificateChainCompleteness(): void {
        try {
            const chain = this.getCertificateChain();
            if (chain.length === 0) return;

            const leafInfo = exploreCertificate(chain[0]);
            const isSelfSigned =
                leafInfo.tbsCertificate.extensions?.subjectKeyIdentifier ===
                leafInfo.tbsCertificate.extensions?.authorityKeyIdentifier?.keyIdentifier;

            // Self-signed certificates don't need a chain
            if (isSelfSigned) return;

            if (chain.length >= 2) {
                // Chain already contains at least leaf + issuer — good
                return;
            }

            // ─── Partial chain detected ────────────────────────────────
            const cn = leafInfo.tbsCertificate.subject.commonName ?? "?";
            const akid = leafInfo.tbsCertificate.extensions?.authorityKeyIdentifier?.keyIdentifier ?? "?";
            warningLog(
                `[NODE-OPCUA-W60] Server certificate "${cn}" is CA-signed ` +
                `but certificate.pem contains only the leaf certificate. ` +
                `Clients may reject the connection with BadCertificateChainIncomplete. ` +
                `(authorityKeyIdentifier: ${akid}). ` +
                `To fix this, ensure the issuer CA certificate chain is appended ` +
                `to ${this.certificateFile}, or re-provision the certificate ` +
                `using the GDS UpdateCertificate workflow.`
            );
        } catch (err) {
            warningLog(`[NODE-OPCUA-W60] Certificate chain check failed: ${(err as Error).message}`);
        }
    }

    /**
     * Compare the current certificate's SAN entries against all
     * explicitly configured hostnames and IPs, and return any
     * that are missing.
     *
     * Returns an empty array when the certificate covers every
     * configured hostname and IP.
     *
     * **Important — ephemeral IP mitigation:**
     * Auto-detected IPs (from `getIpAddresses()`) are deliberately
     * NOT included in this check. Network interfaces are transient
     * — WiFi IPs change on reconnect, tethering IPs appear/disappear,
     * VPN adapters come and go. Including them would cause the
     * `[NODE-OPCUA-W26]` warning to fire on every server restart
     * whenever the network state differs from when the certificate
     * was originally created.
     *
     * Only **explicitly configured** values are checked:
     * - Hostnames: FQDN, os.hostname(), `alternateHostname` (non-IP),
     *   hostnames from `advertisedEndpoints` URLs
     * - IPs: IP literals from `alternateHostname`, IP literals
     *   from `advertisedEndpoints` URLs
     *
     * The certificate itself still includes auto-detected IPs at
     * creation time — this is fine because it captures the network
     * state at that moment. But the *mismatch warning* only fires
     * for things the user explicitly asked for.
     */
    public checkCertificateSAN(): string[] {
        const certDer = this.getCertificate();
        const info = exploreCertificate(certDer);
        const sanDns: string[] = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];
        const sanIpsHex: string[] = info.tbsCertificate.extensions?.subjectAltName?.iPAddress || [];

        const fqdn = getFullyQualifiedDomainName();
        const hostname = getHostname();
        const expectedDns = [...new Set([fqdn, hostname, ...this.getConfiguredHostnames()])].sort();

        // Only check explicitly configured IPs — NOT auto-detected ones.
        // See JSDoc above for the rationale (ephemeral network interfaces).
        const expectedIps = [...new Set(this.getConfiguredIPs())].sort();

        const missingDns = expectedDns.filter((name) => !sanDns.includes(name));
        // exploreCertificate returns iPAddress entries as hex strings
        // Only IPv4 addresses can be converted with ipv4ToHex here; IPv6 (and invalid) IPs are skipped.
        const missingIps = expectedIps.filter((ip) => {
            const family = isIP(ip);
            if (family === 4) {
                return !sanIpsHex.includes(ipv4ToHex(ip));
            }
            // IPv6 or invalid literals are currently not matched against SAN iPAddress entries here.
            return false;
        });

        return [...missingDns, ...missingIps];
    }

    /**
     * Delete the existing self-signed certificate and create a new
     * one that includes all currently configured hostnames.
     *
     * @throws if the current certificate was NOT self-signed
     *         (i.e. issued by a CA or GDS)
     */
    public async regenerateSelfSignedCertificate(): Promise<void> {
        // guard: only allow regeneration of self-signed certs
        const certDer = this.getCertificate();
        const info = exploreCertificate(certDer);
        const issuer = info.tbsCertificate.issuer;
        const subject = info.tbsCertificate.subject;
        const isSelfSigned = issuer.commonName === subject.commonName && issuer.organizationName === subject.organizationName;
        if (!isSelfSigned) {
            throw new Error("Cannot regenerate certificate: current certificate is not self-signed (issued by a CA or GDS)");
        }

        // delete old cert
        if (fs.existsSync(this.certificateFile)) {
            fs.unlinkSync(this.certificateFile);
        }
        // recreate with current hostnames
        await this.createDefaultCertificate();
        // invalidate cached cert so next getCertificate() reloads from disk
        this.invalidateCachedCertificates();
    }

    private _checkCertificateSanMismatch(): void {
        try {
            const missing = this.checkCertificateSAN();
            if (missing.length > 0) {
                warningLog(
                    `[NODE-OPCUA-W26] Certificate SAN is missing the following configured hostnames/IPs: ${missing.join(", ")}. ` +
                    "Clients with strict certificate validation may reject connections for these entries. " +
                    "Use server.regenerateSelfSignedCertificate() to fix this."
                );
            }
        } catch (_err) {
            // ignore errors during SAN check (e.g. cert not yet loaded)
        }
    }

    /**
     * start all registered endPoint, in parallel, and call done when all endPoints are listening.
     */
    public start(): Promise<void>;
    public start(done: () => void): void;
    public start(...args: [((err?: Error) => void)?]): Promise<void> | void {
        const callback = args[0];
        if (!callback || args.length === 0) {
            return this.startAsync();
        } else {
            this.startAsync()
                .then(() => {
                    callback();
                })
                .catch((err) => callback(err));
        }
    }

    protected async performPreInitialization(): Promise<void> {
        const tasks = this._preInitTask;
        this._preInitTask = [];
        for (const task of tasks) {
            await task();
        }
    }

    protected async startAsync(): Promise<void> {
        await this.performPreInitialization();

        assert(Array.isArray(this.endpoints));
        assert(this.endpoints.length > 0, "We need at least one end point");

        installPeriodicClockAdjustment();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const server: OPCUABaseServer<OPCUABaseServerEvents> = this;
        const _on_new_channel = function (this: OPCUAServerEndPoint, channel: ServerSecureChannelLayer) {
            server.emit("newChannel", channel, this);
        };

        const _on_channel_secured = function (this: OPCUAServerEndPoint, channel: ServerSecureChannelLayer) {
            // Install a response interceptor once per channel so the
            // server can emit "response" events for diagnostics.
            // Done here (after OpenSecureChannel) rather than at
            // newChannel time, so the interceptor can rely on
            // securityPolicy/securityMode being populated.
            channel.setResponseInterceptor((_msg, response1) => {
                server.emit("response", response1, channel);
            });
            server.emit("channelSecured", channel, this);
        };

        const _on_close_channel = function (this: OPCUAServerEndPoint, channel: ServerSecureChannelLayer) {
            server.emit("closeChannel", channel, this);
        };

        const _on_connectionRefused = function (this: OPCUAServerEndPoint, socketData: ISocketData) {
            server.emit("connectionRefused", socketData, this);
        };

        const _on_openSecureChannelFailure = function (
            this: OPCUAServerEndPoint,
            socketData: ISocketData,
            channelData: IChannelData
        ) {
            server.emit("openSecureChannelFailure", socketData, channelData, this);
        };

        const promises: Promise<void>[] = [];

        for (const endpoint of this.endpoints) {
            assert(!endpoint._on_close_channel);

            endpoint._on_new_channel = _on_new_channel;
            endpoint.on("newChannel", endpoint._on_new_channel);

            endpoint._on_channel_secured = _on_channel_secured;
            endpoint.on("channelSecured", endpoint._on_channel_secured);

            endpoint._on_close_channel = _on_close_channel;
            endpoint.on("closeChannel", endpoint._on_close_channel);

            endpoint._on_connectionRefused = _on_connectionRefused;
            endpoint.on("connectionRefused", endpoint._on_connectionRefused);

            endpoint._on_openSecureChannelFailure = _on_openSecureChannelFailure;
            endpoint.on("openSecureChannelFailure", endpoint._on_openSecureChannelFailure);

            promises.push(new Promise<void>((resolve, reject) => endpoint.start((err) => (err ? reject(err) : resolve()))));
        }
        await Promise.all(promises);
    }

    /**
     * shutdown all server endPoints
     */
    public shutdown(done: (err?: Error | null) => void): void {
        assert(typeof done === "function");
        uninstallPeriodicClockAdjustment();
        this.serverCertificateManager
            .dispose()
            .catch((err) => {
                // The certificate manager may already be disposing if
                // userCertificateManager and serverCertificateManager
                // point to the same instance (common in tests).
                debugLog("OPCUABaseServer#shutdown serverCertificateManager.dispose() error:", err.message);
            })
            .then(() => {
                debugLog("OPCUABaseServer#shutdown starting");
                const promises = this.endpoints.map((endpoint) => {
                    return new Promise<void>((resolve, reject) => {
                        cleanupEndpoint(endpoint);
                        endpoint.shutdown((err) => (err ? reject(err) : resolve()));
                    });
                });
                Promise.all(promises)
                    .then(() => {
                        debugLog("shutdown completed");
                        done();
                    })
                    .catch((err) => done(err));
            });
    }

    public async shutdownChannels(): Promise<void>;
    public shutdownChannels(callback: (err?: Error | null) => void): void;
    public shutdownChannels(callback?: (err?: Error | null) => void): Promise<void> | void {
        assert(typeof callback === "function");
        // c8 ignore next
        if (!callback) throw new Error("thenify is not available");
        debugLog("OPCUABaseServer#shutdownChannels");
        const promises = this.endpoints.map((endpoint) => {
            return new Promise<void>((resolve, reject) => {
                debugLog(" shutting down endpoint ", endpoint.endpointDescriptions()[0].endpointUrl);
                endpoint.abruptlyInterruptChannels();
                endpoint.shutdown((err) => (err ? reject(err) : resolve()));
            });
        });
        Promise.all(promises)
            .then(() => callback())
            .catch((err) => callback?.(err));
    }

    /**
     * @private
     */
    public on_request(message: Message, channel: ServerSecureChannelLayer): void {
        assert(message.request);
        assert(message.requestId !== 0);
        const request = message.request;

        // prepare request
        this.prepare(message, channel);

        if (doDebug) {
            debugLog(
                chalk.green.bold("--------------------------------------------------------"),
                channel.channelId,
                request.schema.name
            );
        }

        let errMessage: string;
        let response: Response;

        (this as OPCUABaseServer<OPCUABaseServerEvents>).emit("request", request, channel);

        try {
            // handler must be named _on_ActionRequest()
            const handler = (this as unknown as Record<string, unknown>)[`_on_${request.schema.name}`];
            if (typeof handler === "function") {
                handler.call(this, message, channel);
            } else {
                errMessage = `[NODE-OPCUA-W07] Unsupported Service : ${request.schema.name}`;
                warningLog(errMessage);
                debugLog(chalk.red.bold(errMessage));
                response = makeServiceFault(StatusCodes.BadServiceUnsupported, [errMessage]);
                channel.send_response("MSG", response, message, emptyCallback);
            }
        } catch (err) {
            /* c8 ignore next */
            const errMessage1 = `[NODE-OPCUA-W08] EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ${request.schema.name}`;
            warningLog(chalk.red.bold(errMessage1));
            warningLog(request.toString());
            displayTraceFromThisProjectOnly(err as Error);

            let additional_messages = [];
            additional_messages.push(`EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! ${request.schema.name}`);
            if (err instanceof Error) {
                additional_messages.push(err.message);
                if (err.stack) {
                    additional_messages = additional_messages.concat(err.stack.split("\n"));
                }
            }
            response = makeServiceFault(StatusCodes.BadInternalError, additional_messages);

            channel.send_response("MSG", response, message, emptyCallback);
        }
    }

    /**
     * Find endpoint descriptions matching a given endpoint URL.
     *
     * When `endpointUrl` is provided, only endpoints whose URL matches
     * (case-insensitive) are returned. When `null` or omitted, all
     * endpoints from every `OPCUAServerEndPoint` are returned.
     *
     * This is the shared resolution path used by both `GetEndpoints`
     * and `CreateSession` (`validate_security_endpoint`).
     *
     * @internal (was _get_endpoints)
     */
    public findMatchingEndpoints(endpointUrl?: string | null): EndpointDescription[] {
        let endpoints: EndpointDescription[] = [];
        for (const endPoint of this.endpoints) {
            const ep = endPoint.endpointDescriptions();
            const epFiltered = endpointUrl ? ep.filter((e) => matchUri(e.endpointUrl, endpointUrl)) : ep;
            endpoints = endpoints.concat(epFiltered);
        }
        return endpoints;
    }
    /**
     * get one of the possible endpointUrl
     */
    public getEndpointUrl(): string {
        return this.findMatchingEndpoints()[0].endpointUrl || "";
    }

    public getDiscoveryUrls(): string[] {
        const urlSet = new Set<string>();
        for (const ep of this.endpoints) {
            for (const desc of ep.endpointDescriptions()) {
                if (desc.endpointUrl) {
                    urlSet.add(desc.endpointUrl);
                }
            }
        }
        return [...urlSet];
    }

    public getServers(_channel: ServerSecureChannelLayer): ApplicationDescription[] {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();
        const servers = [this.serverInfo];
        return servers;
    }

    /**
     * set all the end point into a state where they do not accept further connections
     *
     * note:
     *     this method is useful for testing purpose
     *
     */
    public async suspendEndPoints(): Promise<void>;
    public suspendEndPoints(callback: (err?: Error | null) => void): void;
    public suspendEndPoints(callback?: (err?: Error | null) => void): void | Promise<void> {
        /* c8 ignore next */
        if (!callback) {
            throw new Error("Internal Error");
        }
        const promises = this.endpoints.map((ep) => {
            return new Promise<void>((resolve, reject) => {
                /* c8 ignore next */
                if (doDebug) {
                    debugLog("Suspending ", ep.endpointDescriptions()[0].endpointUrl);
                }
                ep.suspendConnection((err?: Error | null) => {
                    /* c8 ignore next */
                    if (doDebug) {
                        debugLog("Suspended ", ep.endpointDescriptions()[0].endpointUrl);
                    }
                    err ? reject(err) : resolve();
                });
            });
        });
        Promise.all(promises)
            .then(() => callback())
            .catch((err) => callback(err));
    }

    /**
     * set all the end point into a state where they do accept connections
     * note:
     *    this method is useful for testing purpose
     */
    public async resumeEndPoints(): Promise<void>;
    public resumeEndPoints(callback: (err?: Error | null) => void): void;
    public resumeEndPoints(callback?: (err?: Error | null) => void): void | Promise<void> {
        // c8 ignore next
        if (!callback) throw new Error("thenify is not available");
        const promises = this.endpoints.map((ep) => {
            return new Promise<void>((resolve, reject) => {
                ep.restoreConnection((err) => (err ? reject(err) : resolve()));
            });
        });
        Promise.all(promises)
            .then(() => callback())
            .catch((err) => callback(err));
    }

    protected prepare(_message: Message, _channel: ServerSecureChannelLayer): void {
        /* empty */
    }

    /**
     * @private
     */
    protected _on_GetEndpointsRequest(message: Message, channel: ServerSecureChannelLayer): void {
        const request = message.request as GetEndpointsRequest;

        assert(request.schema.name === "GetEndpointsRequest");

        const response = new GetEndpointsResponse({});

        /**
         * endpointUrl	String	The network address that the Client used to access the DiscoveryEndpoint.
         *                      The Server uses this information for diagnostics and to determine what URLs to return in the response.
         *                      The Server should return a suitable default URL if it does not recognize the HostName in the URL
         * localeIds   []LocaleId	List of locales to use.
         *                          Specifies the locale to use when returning human readable strings.
         * profileUris []	String	List of Transport Profile that the returned Endpoints shall support.
         *                          OPC 10000-7 defines URIs for the Transport Profiles.
         *                          All Endpoints are returned if the list is empty.
         *                          If the URI is a URL, this URL may have a query string appended.
         *                          The Transport Profiles that support query strings are defined in OPC 10000-7.
         */
        response.endpoints = this.findMatchingEndpoints(null);
        const _e = response.endpoints.map((e) => e.endpointUrl);
        if (request.endpointUrl) {
            const filtered = response.endpoints.filter((endpoint: EndpointDescription) =>
                matchUri(endpoint.endpointUrl, request.endpointUrl)
            );
            if (filtered.length > 0) {
                response.endpoints = filtered;
            }
        }
        response.endpoints = response.endpoints.filter(
            (endpoint: EndpointDescription) => !(endpoint as unknown as { restricted: boolean }).restricted
        );

        // apply filters
        if (request.profileUris && request.profileUris.length > 0) {
            const profileUris = request.profileUris;
            response.endpoints = response.endpoints.filter(
                (endpoint: EndpointDescription) => profileUris.indexOf(endpoint.transportProfileUri) >= 0
            );
        }

        // adjust locale on ApplicationName to match requested local or provide
        // a string with neutral locale (locale === null)
        // TODO: find a better way to handle this
        response.endpoints.forEach((endpoint: EndpointDescription) => {
            endpoint.server.applicationName.locale = "en-US";
        });

        channel.send_response("MSG", response, message, emptyCallback);
    }

    /**
     * @private
     */
    protected _on_FindServersRequest(message: Message, channel: ServerSecureChannelLayer): void {
        // Release 1.02  13  OPC Unified Architecture, Part 4 :
        //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
        //   attacks. A  Server  should minimize the amount of processing required to send the response for this
        //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
        //   short delay before starting processing of a request during high traffic conditions.

        const shortDelay = 100; // milliseconds
        setTimeout(() => {
            const request = message.request;
            assert(request.schema.name === "FindServersRequest");
            if (!(request instanceof FindServersRequest)) {
                throw new Error("Invalid request type");
            }

            let servers = this.getServers(channel);
            // apply filters
            // TODO /
            if (request.serverUris && request.serverUris.length > 0) {
                const serverUris = request.serverUris;
                // A serverUri matches the applicationUri from the ApplicationDescription define
                servers = servers.filter((inner_Server: ApplicationDescription) => {
                    return serverUris.indexOf(inner_Server.applicationUri) >= 0;
                });
            }

            function adapt(applicationDescription: ApplicationDescription): ApplicationDescription {
                return new ApplicationDescription({
                    applicationName: applicationDescription.applicationName,
                    applicationType: applicationDescription.applicationType,
                    applicationUri: applicationDescription.applicationUri,
                    discoveryProfileUri: applicationDescription.discoveryProfileUri,
                    discoveryUrls: applicationDescription.discoveryUrls,
                    gatewayServerUri: applicationDescription.gatewayServerUri,
                    productUri: applicationDescription.productUri
                });
            }

            const response = new FindServersResponse({
                servers: servers.map(adapt)
            });

            channel.send_response("MSG", response, message, emptyCallback);
        }, shortDelay);
    }

    /**
     * returns a array of currently active channels
     */
    protected getChannels(): ServerSecureChannelLayer[] {
        let channels: ServerSecureChannelLayer[] = [];

        for (const endpoint of this.endpoints) {
            const c = endpoint.getChannels();
            channels = channels.concat(c);
        }
        return channels;
    }
}

/**
 * construct a service Fault response
 */
function makeServiceFault(statusCode: StatusCode, messages: string[]): ServiceFault {
    const response = new ServiceFault();
    response.responseHeader.serviceResult = statusCode;
    // xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    assert(Array.isArray(messages));
    assert(typeof messages[0] === "string");

    response.responseHeader.stringTable = messages;
    // tslint:disable:no-console
    warningLog(chalk.cyan(" messages "), messages.join("\n"));
    return response;
}

// tslint:disable:no-var-requires
import { withCallback } from "thenify-ex";

const opts = { multiArgs: false };
OPCUABaseServer.prototype.resumeEndPoints = withCallback(OPCUABaseServer.prototype.resumeEndPoints, opts);
OPCUABaseServer.prototype.suspendEndPoints = withCallback(OPCUABaseServer.prototype.suspendEndPoints, opts);
OPCUABaseServer.prototype.shutdownChannels = withCallback(OPCUABaseServer.prototype.shutdownChannels, opts);
