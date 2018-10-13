// tslint:disable:no-empty
// tslint:disable:unused-variable
import * as util from "util";
import * as  net from "net";

import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { setFakeTransport } from "../source";


export class HalfComChannel extends EventEmitter {
    public _hasEnded: boolean;

    constructor() {
        super();
        this._hasEnded = false;
    }

    write(data: string | Buffer) {

        if (typeof data === "string") {
            data = Buffer.from(data);
        }
        assert(data instanceof Buffer, "HalfComChannel.write expecting a buffer");
        const copy = Buffer.concat([data]);
        this.emit("send_data", copy);
    }

    end() {
        if (!this._hasEnded) {
            assert(!this._hasEnded, "half communication channel has already ended !");
            this._hasEnded = true;
            this.emit("ending");
            this.emit("end");
        }
    }

    destroy() {
    }

    setTimeout() {
    }
}

export class DirectTransport extends EventEmitter {

    public client: HalfComChannel;
    public server: HalfComChannel;

    private _responses?: any[];

    public url: string;

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

        this.server.on("end", (err: Error) => {
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

    initialize(done: () => void) {
        setFakeTransport(this.client);
        done();
    }

    shutdown(done: () => void) {
        this.client.end();
        this.server.end();
        if (done) {
            setImmediate(done);
        }
    }


    popResponse() {
        if (!this._responses) {
            return null;
        }
        return this._responses.shift();

    }

    pushResponse(func: any) {
        this._responses = this._responses || [];
        this._responses.push(func);
    }

}

export class FakeServer extends EventEmitter {

    public port: number;
    public url: string;
    public tcpServer: net.Server;
    protected _serverSocket?: net.Socket;
    private _responses?: any[];

    constructor() {
        super();
        const port = 5678;
        this.port = port;

        this.url = "opc.tcp://localhost:" + port;

        this.tcpServer = new net.Server();


        this._serverSocket = undefined;

        this.tcpServer.on("connection", (socket: net.Socket) => {
            assert(!this._serverSocket, " already connected");
            this._serverSocket = socket;

            this._serverSocket.on("data", (data: Buffer) => {
                const func = this.popResponse();
                if (func) {
                    func(this._serverSocket, data);
                }
            });
            this._serverSocket.on("err", (err: Error) => {
                // console.log(" @@@@ socket err ",err);
            });
            this._serverSocket.on("close", (err?: Error) => {
                // console.log(" @@@@ socket closed ",err);
            });
            this._serverSocket.on("end", (err?: Error) => {
                // console.log(" @@@@ socket end ",err);
                this.emit("end", err);
            });
        });
    }


    initialize(done: () => void) {

        this.tcpServer.listen(this.port, (err: Error) => {
            if (err) {
                throw new Error(" cannot listing to port " + this.port);
            }
            done();
        });
    }


    shutdown(callback: (err?: Error) => void) {
        this.tcpServer.close(callback);
    }

    popResponse() {
        if (!this._responses) {
            return null;
        }
        return this._responses.shift();
    }

    pushResponse(func: any) {
        this._responses = this._responses || [];
        this._responses.push(func);
    }

}

export class SocketTransport extends FakeServer {


    private client: net.Socket;
    private server?: net.Socket;

    constructor() {

        super();

        this.client = new net.Socket();
        this.client.connect(this.port, (err?: Error) => {
        });

    }

    initialize(done: () => void) {
        super.initialize(() => {
            this.tcpServer.on("connection", (socket: net.Socket) => {
                this.server = this._serverSocket;
                done();
            });
        });
    }

    shutdown(done: (err?: Error) => void) {
        this.client.end();
        super.shutdown((err?: Error) => {
            done(err);
        });
    }
}
