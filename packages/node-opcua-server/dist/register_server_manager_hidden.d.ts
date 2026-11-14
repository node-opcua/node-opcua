/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager.js";
/**
 * a IRegisterServerManager that hides the server from any local discover server
 *
 */
export declare class RegisterServerManagerHidden extends EventEmitter implements IRegisterServerManager {
    discoveryServerEndpointUrl: string;
    constructor(_options?: {
        server?: unknown;
    });
    stop(): Promise<void>;
    start(): Promise<void>;
    dispose(): void;
    getState(): RegisterServerManagerStatus;
}
//# sourceMappingURL=register_server_manager_hidden.d.ts.map