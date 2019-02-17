/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";
import { IRegisterServerManager } from "./I_register_server_manager";

/**
 * a IRegisterServerManager that hides the server from any local discover server
 *
 */
export class RegisterServerManagerHidden
  extends EventEmitter
  implements IRegisterServerManager {

    public discoveryServerEndpointUrl: string = "";

    constructor(options?: any) {
        super();
    }

    public stop(callback: () => void) {
        setImmediate(callback);
    }

    public start(callback: () => void) {
        setImmediate(callback);
    }

    public dispose() {
        //
    }

}
