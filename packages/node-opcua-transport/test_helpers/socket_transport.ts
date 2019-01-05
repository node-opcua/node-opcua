// tslint:disable:no-empty
import * as  net from "net";
import { FakeServer } from "./fake_server";

export class SocketTransport extends FakeServer {

    private client: net.Socket;
    private server?: net.Socket;

    constructor() {

        super();

        this.client = new net.Socket();
        this.client.connect(this.port, (err?: Error) => {
        });
    }

    public initialize(done: () => void) {
        super.initialize(() => {
            this.tcpServer.on("connection", (socket: net.Socket) => {
                this.server = this._serverSocket;
                done();
            });
        });
    }

    public shutdown(done: (err?: Error) => void) {
        this.client.end();
        super.shutdown((err?: Error) => {
            done(err);
        });
    }
}
