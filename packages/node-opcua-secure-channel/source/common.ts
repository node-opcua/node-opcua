/**
 * @module node-opcua-secure-channel
 */
import { TypeSchemaBase } from "node-opcua-factory";
import {
    CloseSecureChannelRequest,
    MessageSecurityMode,
    RequestHeader,
    ResponseHeader
} from "node-opcua-service-secure-channel";
import { ServiceFault } from "./services";

export interface ResponseB {
    responseHeader: ResponseHeader;
    schema: TypeSchemaBase;
}

export type Response = ResponseB | ServiceFault ;

export interface RequestB {
    requestHeader: RequestHeader;
    schema: TypeSchemaBase;
    securityMode: MessageSecurityMode;
}

export type Request = RequestB | CloseSecureChannelRequest;

export type ErrorCallback = (err?: Error) => void;
export type Callback2<T> = (err: Error|null, result?: T ) => void;

export { ICertificateKeyPairProvider } from "node-opcua-common";
