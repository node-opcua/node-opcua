import * as net from "net";
import { ISocketLike } from "../source";
import { FakeServer } from "./fake_server";
import { ITransportPair } from "./ITransportPair";

export class TransportPairSocket implements ITransportPair {
    public client: net.Socket;
    public server: ISocketLike;
    private _server: FakeServer;

    constructor({ port }: { port: number }) {
        this.server = null as unknown as ISocketLike;
        this._server = new FakeServer({ port });
        this.client = new net.Socket();
        this.client.connect(port, (err?: Error): void => {
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
