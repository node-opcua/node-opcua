/**
 * @module node-opcua-server
 */
// RegisterServerManagerMDNSONLY
import { EventEmitter } from "node:events";
import { assert } from "node-opcua-assert";
import { BonjourHolder } from "node-opcua-service-discovery";
import { OPCUABaseServer } from "./base_server.js";
import { RegisterServerManagerStatus } from "./i_register_server_manager.js";
/**
 * a RegisterServerManager that declare the server the OPCUA Bonjour service
 * available on the current computer
 */
export class RegisterServerManagerMDNSONLY extends EventEmitter {
    discoveryServerEndpointUrl = "";
    server;
    bonjour;
    _state = RegisterServerManagerStatus.NOT_APPLICABLE;
    constructor(options) {
        super();
        this.server = options.server;
        assert(this.server);
        assert(this.server instanceof OPCUABaseServer);
        this.bonjour = new BonjourHolder();
        this._state = RegisterServerManagerStatus.INITIALIZING;
    }
    async stop() {
        if (this.bonjour) {
            this._state = RegisterServerManagerStatus.UNREGISTERING;
            await this.bonjour.stopAnnouncedOnMulticastSubnet();
            this.emit("serverUnregistered");
            this._state = RegisterServerManagerStatus.INACTIVE;
        }
    }
    async start() {
        /* c8 ignore next */
        if (!this.server) {
            throw new Error("internal error");
        }
        assert(this.server instanceof OPCUABaseServer);
        const host = "TODO-find how to extract hostname";
        const capabilities = this.server.capabilitiesForMDNS;
        if (!this.server.serverInfo.applicationUri) {
            throw new Error("internal error: expecting a valid applicationUri");
        }
        const name = this.server.serverInfo.applicationUri;
        const port = this.server.endpoints[0].port;
        this._state = RegisterServerManagerStatus.REGISTERING;
        await this.bonjour.announcedOnMulticastSubnet({
            capabilities: capabilities,
            name: name,
            path: "/", // <- to do
            host,
            port: port
        });
        this._state = RegisterServerManagerStatus.WAITING;
        this.emit("serverRegistered");
    }
    dispose() {
        assert(!this.bonjour.isStarted());
        assert(this.server);
        this.server = undefined;
    }
    getState() {
        return this._state;
    }
}
//# sourceMappingURL=register_server_manager_mdns_only.js.map