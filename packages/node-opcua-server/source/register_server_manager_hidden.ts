/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";
import { IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager";

/**
 * a IRegisterServerManager that hides the server from any local discover server
 *
 */
export class RegisterServerManagerHidden extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl = "";

    constructor(options?: {
        /** */
    }) {
        super();
    }

    public async stop(): Promise<void> {
    }

    public async start(): Promise<void> {
    }

    public dispose(): void {
        //
    }
    public getState(): RegisterServerManagerStatus {
        return RegisterServerManagerStatus.NOT_APPLICABLE;
    }
}
