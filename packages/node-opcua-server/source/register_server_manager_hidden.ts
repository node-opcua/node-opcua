/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager.js";

/**
 * a IRegisterServerManager that hides the server from any local discover server
 *
 */
export class RegisterServerManagerHidden extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl = "";

    constructor(_options?: { server?: unknown }) {
        super();
    }

    public async stop(): Promise<void> {}

    public async start(): Promise<void> {}

    public dispose(): void {
        //
    }
    public getState(): RegisterServerManagerStatus {
        return RegisterServerManagerStatus.NOT_APPLICABLE;
    }
}
