/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";
import { IRegisterServerManager } from "./i_register_server_manager";

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

    public stop(callback: () => void): void {
        setImmediate(callback);
    }

    public start(callback: () => void): void {
        setImmediate(callback);
    }

    public dispose(): void {
        //
    }
}
