import { EventEmitter } from "node:events";
import net from "node:net";
import { assert } from "node-opcua-assert";
import type { ISocketLike } from "../source/index.js";

export class FakeServer extends EventEmitter {
    public port: number;
    public url: string;
    public tcpServer: net.Server;
    protected _serverSocket?: net.Socket;
    private _responses?: Array<(socket: net.Socket, data: Buffer) => void>;

    constructor({ port }: { port: number }) {
        super();
        this.port = port;

        this.url = `opc.tcp://localhost:${port}`;

        this.tcpServer = new net.Server();

        this._serverSocket = undefined;

        this.tcpServer.on("connection", (socket: net.Socket) => {
            assert(!this._serverSocket, " already connected");
            this._serverSocket = socket;

            this._serverSocket.on("data", (data: Buffer) => {
                const func = this.popResponse();
                if (func && this._serverSocket) {
                    func(this._serverSocket, data);
                }
            });
            this._serverSocket.on("err", (_err: Error) => {
                // console.log(" @@@@ socket err ",err);
            });
            this._serverSocket.on("close", (_err?: Error) => {
                // console.log(" @@@@ socket closed ",err);
            });
            this._serverSocket.on("end", (err?: Error) => {
                // console.log(" @@@@ socket end ",err);
                this.emit("end", err);
            });
        });
    }

    public getSocket(): ISocketLike {
        // c8 ignore next
        if (!this._serverSocket) {
            throw new Error("No socket available");
        }
        return this._serverSocket;
    }

    public initialize(done: () => void): void {
        this.tcpServer.listen(this.port, () => {
            done();
        });
    }

    public shutdown(callback: (err?: Error) => void): void {
        // close() stops the server accepting, but resolves only once every existing
        // connection has ended - and this server keeps one. A test that leaves its
        // socket open therefore never frees the port, the afterEach times out, and the
        // next beforeEach binds the same fixed port and fails with EADDRINUSE. That was
        // invisible while the suite ran one file at a time and the socket happened to
        // close first; under the parallel runner the machine is loaded and it does not.
        //
        // Destroying the tracked socket is enough: the connection handler asserts this
        // server never holds more than one. destroy() is optional-called because
        // transport_pair_socket.ts reuses FakeServer with an emulated socket.
        this._serverSocket?.destroy?.();
        this._serverSocket = undefined;
        this.tcpServer.close(callback);
    }

    public popResponse(): ((socket: net.Socket, data: Buffer) => void) | null {
        if (!this._responses) {
            return null;
        }
        return this._responses.shift() || null;
    }

    public pushResponse(func: (socket: net.Socket, data: Buffer) => void): void {
        this._responses = this._responses || [];
        this._responses.push(func);
    }
}
