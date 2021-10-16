/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";
import { ErrorCallback } from "node-opcua-status-code";

export interface IRegisterServerManager extends EventEmitter {
    discoveryServerEndpointUrl: string;

    start(callback: ErrorCallback): void;

    stop(callback: ErrorCallback): void;

    dispose(): void;

    // tslint:disable:unified-signatures
    on(eventName: "serverRegistrationPending", eventHandler: () => void): this;
    on(eventName: "serverRegistered", eventHandler: () => void): this;
    on(eventName: "serverRegistrationRenewed", eventHandler: () => void): this;
    on(eventName: "serverUnregistered", eventHandler: () => void): this;
}
