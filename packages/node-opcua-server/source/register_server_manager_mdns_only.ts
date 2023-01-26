/**
 * @module node-opcua-server
 */
// RegisterServerManagerMDNSONLY

import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { BonjourHolder } from "node-opcua-service-discovery";
import { OPCUABaseServer } from "./base_server";
import { IRegisterServerManager } from "./i_register_server_manager";

/**
 * a RegisterServerManager that declare the server the OPCUA Bonjour service
 * available on the current computer
 */
export class RegisterServerManagerMDNSONLY extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl = "";

    private server?: OPCUABaseServer;
    private bonjour: BonjourHolder;

    constructor(options: { server: OPCUABaseServer }) {
        super();
        this.server = options.server;
        assert(this.server);
        assert(this.server instanceof OPCUABaseServer);
        this.bonjour = new BonjourHolder();
    }

    public stop(callback: () => void): void {
        if (this.bonjour) {
            this.bonjour.stopAnnouncedOnMulticastSubnetWithCallback(()=>{
                this.emit("serverUnregistered");
                setImmediate(callback);
            });
        }
    }

    public start(callback: () => void): void {
        // istanbul ignore next
        if (!this.server) {
            throw new Error("internal error");
        }
        assert(this.server instanceof OPCUABaseServer);

        this.bonjour.announcedOnMulticastSubnetWithCallback({
            capabilities: this.server.capabilitiesForMDNS,
            name: this.server.serverInfo.applicationUri!,
            path: "/", // <- to do
            port: this.server.endpoints[0].port
        }, ()=>{
            this.emit("serverRegistered");
            setImmediate(callback);
        });
    }

    public dispose(): void {
        assert(!this.bonjour.isStarted());
        assert(this.server);
        this.server = undefined;
    }
}
