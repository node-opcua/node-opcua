import net from "node:net";
import type { ISocketLike } from "../source/index.js";
import { FakeServer } from "./fake_server.js";
import type { ITransportPair } from "./ITransportPair.js";

export class TransportPairSocket implements ITransportPair {
    public client: net.Socket;
    public server: ISocketLike;
    private _server: FakeServer;

    constructor({ port }: { port: number }) {
        this.server = null as unknown as ISocketLike;
        this._server = new FakeServer({ port });
        this.client = new net.Socket();
        this.client.connect(port, (_err?: Error): void => {
            /** */
        });
    }

    public initialize(done: (err?: Error) => void): void {
        this._server.initialize(() => {
            this._server.tcpServer.on("connection", (socket: net.Socket) => {
                if (this.server) return done(new Error("already connected"));
                this.server = socket;
                done();
            });
        });
    }

    public shutdown(done: (err?: Error) => void): void {
        this.client.end(() => {
            this._server.shutdown((err?: Error) => {
                done(err);
            });
        });
    }
}
