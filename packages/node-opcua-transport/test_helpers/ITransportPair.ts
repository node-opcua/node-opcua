import type { ISocketLike } from "../source/index.js";

export interface ITransportPair {
    initialize(callback: (err?: Error) => void): void;

    shutdown(callback: (err?: Error) => void): void;

    client: ISocketLike;
    server: ISocketLike;
}
