/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { RegisterServerManagerStatus } from "./i_register_server_manager.js";
/**
 * a IRegisterServerManager that hides the server from any local discover server
 *
 */
export class RegisterServerManagerHidden extends EventEmitter {
    discoveryServerEndpointUrl = "";
    constructor(_options) {
        super();
    }
    async stop() { }
    async start() { }
    dispose() {
        //
    }
    getState() {
        return RegisterServerManagerStatus.NOT_APPLICABLE;
    }
}
//# sourceMappingURL=register_server_manager_hidden.js.map