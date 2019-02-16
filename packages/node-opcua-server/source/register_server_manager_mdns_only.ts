/**
 * @module node-opcua-server
 */
// RegisterServerManagerMDNSONLY

import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import {
    _announcedOnMulticastSubnet,
    _stop_announcedOnMulticastSubnet
} from "node-opcua-service-discovery";
import { OPCUABaseServer } from "./base_server";
import { IRegisterServerManager } from "./I_register_server_manager";

/**
 *
 * @param options
 * @constructor
 */
export class  RegisterServerManagerMDNSONLY
  extends EventEmitter
    implements IRegisterServerManager {

    public discoveryServerEndpointUrl: string = "";

    private server?: OPCUABaseServer;
    private bonjour: any |null;

    constructor(options: any) {
        super();

        const self = this;
        self.server = options.server;
        assert(self.server);
        assert(self.server instanceof OPCUABaseServer);
        self.bonjour = null;
    }

    public stop(callback: () => void) {
        const self = this;
        _stop_announcedOnMulticastSubnet(self);
        setImmediate(() => {
            self.emit("serverUnregistered");
            setImmediate(callback);
        });
    }

    public start(callback: () => void) {
        const self = this;
        if (!self.server) {
            throw new Error("internal error");
        }
        assert(self.server instanceof OPCUABaseServer);

        _announcedOnMulticastSubnet(self, {
            applicationUri: self.server.serverInfo.applicationUri!,
            capabilities: self.server.capabilitiesForMDNS,
            path: "/", // <- to do
            port: self.server.endpoints[0].port,
        });
        setImmediate(() => {
            self.emit("serverRegistered");
            setImmediate(callback);
        });
    }

    public dispose() {
        this.server = undefined;
    }
}
