import { EventEmitter } from "node:events";
import net from "node:net";
import { assert } from "node-opcua-assert";
import type { ISocketLike } from "../source";

export class FakeServer extends EventEmitter {
    public port: number;
    public url: string;
    public tcpServer: net.Server;
    protected _serverSocket?: net.Socket;
    private _responses?: any[];

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
        this.tcpServer.close(callback);
    }

    public popResponse(): ((socket: net.Socket, data: Buffer) => void) | null {
        if (!this._responses) {
            return null;
        }
        return this._responses.shift();
    }

    public pushResponse(func: (socket: net.Socket, data: Buffer) => void): void {
        this._responses = this._responses || [];
        this._responses.push(func);
    }
}
