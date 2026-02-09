/**
 * @module node-opcua-server
 */
// RegisterServerManagerMDNSONLY

import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { BonjourHolder } from "node-opcua-service-discovery";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { OPCUABaseServer } from "./base_server";
import { IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager";

/**
 * Extract hostname and path from an OPC UA endpoint URL
 * @param endpointUrl - URL like "opc.tcp://hostname:port/path"
 * @returns { host, path } or null if parsing fails
 */
function parseEndpointUrl(endpointUrl: string): { host: string; path: string } | null {
    const match = endpointUrl.match(/^opc\.tcp:\/\/([^:/]+)(?::\d+)?(\/.*)?$/);
    if (!match) return null;
    return {
        host: match[1],
        path: match[2] || "/"
    };
}

/**
 * a RegisterServerManager that declare the server the OPCUA Bonjour service
 * available on the current computer
 */
export class RegisterServerManagerMDNSONLY extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl = "";

    private server?: OPCUABaseServer;
    private bonjour: BonjourHolder;
    private _state: RegisterServerManagerStatus = RegisterServerManagerStatus.NOT_APPLICABLE;

    constructor(options: { server: OPCUABaseServer }) {
        super();
        this.server = options.server;
        assert(this.server);
        assert(this.server instanceof OPCUABaseServer);
        this.bonjour = new BonjourHolder();
        this._state = RegisterServerManagerStatus.INITIALIZING;
    }

    public async stop(): Promise<void> {
        if (this.bonjour) {

            this._state = RegisterServerManagerStatus.UNREGISTERING;
            await this.bonjour.stopAnnouncedOnMulticastSubnet();
            this.emit("serverUnregistered");
            this._state = RegisterServerManagerStatus.INACTIVE;
        }
    }

    public async start(): Promise<void> {
        // istanbul ignore next
        if (!this.server) {
            throw new Error("internal error");
        }
        assert(this.server instanceof OPCUABaseServer);

        const capabilities = this.server.capabilitiesForMDNS;
        const name = this.server.serverInfo.applicationUri!;
        const port = this.server.endpoints[0].port;

        // Extract hostname and path from the first endpoint's URL
        const endpointDescriptions = this.server.endpoints[0].endpointDescriptions();
        const endpointUrl = endpointDescriptions[0]?.endpointUrl;
        const parsed = endpointUrl ? parseEndpointUrl(endpointUrl) : null;

        // Use parsed hostname, or fall back to FQDN
        const host = parsed?.host || getFullyQualifiedDomainName();
        const path = parsed?.path || "/";

        this._state = RegisterServerManagerStatus.REGISTERING;
        await this.bonjour.announcedOnMulticastSubnet({
            capabilities: capabilities,
            name: name,
            path: path,
            host,
            port: port
        });
        this._state = RegisterServerManagerStatus.WAITING;
        this.emit("serverRegistered");
    }

    public dispose(): void {
        assert(!this.bonjour.isStarted());
        assert(this.server);
        this.server = undefined;
    }
    public getState(): RegisterServerManagerStatus {
        return this._state;
    }
}
