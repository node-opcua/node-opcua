// tslint:disable:no-empty
import * as net from "net";
import { FakeServer } from "./fake_server";

export class SocketTransport extends FakeServer {
    private client: net.Socket;
    private server?: net.Socket;

    constructor({ port }: { port: number }) {
        super({ port });

        this.client = new net.Socket();
        this.client.connect(this.port, (err?: Error): void => {
            /** */
        });
    }

    public initialize(done: () => void): void {
        super.initialize(() => {
            this.tcpServer.on("connection", (socket: net.Socket) => {
                this.server = this._serverSocket;
                done();
            });
        });
    }

    public shutdown(done: (err?: Error) => void): void {
        this.client.end();
        super.shutdown((err?: Error) => {
            done(err);
        });
    }
}
