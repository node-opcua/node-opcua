import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { setFakeTransport } from "../source";
import { HalfComChannel } from "./half_com_channel";

export interface DirectTransport {
    on(eventName: "end", eventHandler:()=>void): this;
}
export class DirectTransport extends EventEmitter {
    public client: HalfComChannel;
    public server: HalfComChannel;
    public url: string;

    private _responses?: ((socket: HalfComChannel, data: Buffer) => void)[];
    constructor() {
        super();

        this.client = new HalfComChannel();
        this.server = new HalfComChannel();

        this.client.on("send_data", (data) => {
            assert(data instanceof Buffer);
            this.server.emit("data", data);
        });
        this.server.on("send_data", (data) => {
            assert(data instanceof Buffer);
            this.client.emit("data", data);
        });
        this.server.on("ending", () => {
            this.client.emit("end");
            this.client._hasEnded = true;
        });
        this.client.on("ending", () => {
            this.server.emit("end");
            this.server._hasEnded = true;
        });

        this.server.on("end", (err?: Error) => {
            this.emit("end", err);
        });

        this.server.on("data", (data: Buffer) => {
            const func = this.popResponse();
            if (func) {
                func(this.server, data);
            }
        });

        this.url = "fake://localhost:2033/SomeAddress";
    }

    public initialize(done: () => void): void {
        setFakeTransport(this.client);
        done();
    }

    public shutdown(done: () => void): void {
        this.client.end();
        this.server.end();
        if (done) {
            setImmediate(done);
        }
    }

    public popResponse(): any {
        if (!this._responses) {
            return null;
        }
        return this._responses.shift();
    }

    public pushResponse(func: (socket: HalfComChannel, data: Buffer) => void): void {
        this._responses = this._responses || [];
        this._responses.push(func);
    }
}
