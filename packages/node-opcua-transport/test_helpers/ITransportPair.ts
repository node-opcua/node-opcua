    import { ISocketLike } from "../source";

export  interface ITransportPair {
    
    initialize(callback: (err?: Error)=> void): void;
    
    shutdown(callback: (err?: Error)=> void): void;

    client: ISocketLike;
    server: ISocketLike;

}