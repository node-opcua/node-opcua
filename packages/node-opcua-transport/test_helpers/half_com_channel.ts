// tslint:disable:no-empty
// tslint:disable:unused-variable
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";

export class HalfComChannel extends EventEmitter {
    public _hasEnded: boolean;

    constructor() {
        super();
        this._hasEnded = false;
    }

    public write(data: string | Buffer) {

        if (typeof data === "string") {
            data = Buffer.from(data);
        }
        assert(data instanceof Buffer, "HalfComChannel.write expecting a buffer");
        const copy = Buffer.concat([data]);
        this.emit("send_data", copy);
    }

    public end() {
        if (!this._hasEnded) {
            assert(!this._hasEnded, "half communication channel has already ended !");
            this._hasEnded = true;
            this.emit("ending");
            this.emit("end");
        }
    }

    public destroy() {
    }

    public setTimeout() {
    }
}
