import { setFakeTransport } from "../source";
import { HalfComChannel } from "./half_com_channel";
import { ITransportPair } from "./ITransportPair";

export class TransportPairDirect implements ITransportPair {
    public client: HalfComChannel;
    public server: HalfComChannel;
    public url: string;

    private _responses?: ((socket: HalfComChannel, data: Buffer) => void)[];
    constructor() {
        this.client = new HalfComChannel();
        this.server = new HalfComChannel();

        this.client.on("send_data", (data) => {
            this.server.onReceiveData(data);
        });
        this.server.on("send_data", (data) => {
            this.client.onReceiveData(data);
        });
        this.server.on("ending", () => {
            this.client.onReceiveEnd();
        });
        this.client.on("ending", () => {
            this.server.onReceiveEnd();
        });

        this.server.on("end", (err?: Error) => {
            //
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
        // this.client.end();
        // this.server.end();
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
