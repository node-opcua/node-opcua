/**
 * @module node-opcua-server
 */
// RegisterServerManagerMDNSONLY

import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { BonjourHolder } from "node-opcua-service-discovery";
import { OPCUABaseServer } from "./base_server";
import { IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager";

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

        const host = "TODO-find how to extract hostname";
        const capabilities = this.server.capabilitiesForMDNS;
        const name = this.server.serverInfo.applicationUri!;
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

    public dispose(): void {
        assert(!this.bonjour.isStarted());
        assert(this.server);
        this.server = undefined;
    }
    public getState(): RegisterServerManagerStatus {
        return this._state;
    }
}
