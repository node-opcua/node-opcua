import { EventEmitter } from "events";
import { IRegisterServerManager } from "./IRegisterServerManager";

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
