/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { OPCUABaseServer } from "./base_server.js";
import { type IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager.js";
/**
 * a RegisterServerManager that declare the server the OPCUA Bonjour service
 * available on the current computer
 */
export declare class RegisterServerManagerMDNSONLY extends EventEmitter implements IRegisterServerManager {
    discoveryServerEndpointUrl: string;
    private server?;
    private bonjour;
    private _state;
    constructor(options: {
        server: OPCUABaseServer;
    });
    stop(): Promise<void>;
    start(): Promise<void>;
    dispose(): void;
    getState(): RegisterServerManagerStatus;
}
//# sourceMappingURL=register_server_manager_mdns_only.d.ts.map