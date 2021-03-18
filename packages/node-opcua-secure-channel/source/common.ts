/**
 * @module node-opcua-secure-channel
 */
import { makeSHA1Thumbprint, split_der } from "node-opcua-crypto";
import { TypeSchemaBase } from "node-opcua-factory";
import { CloseSecureChannelRequest, MessageSecurityMode, RequestHeader, ResponseHeader } from "node-opcua-service-secure-channel";
import { ServiceFault } from "./services";

export interface ResponseB {
    responseHeader: ResponseHeader;
    schema: TypeSchemaBase;
}

export type Response = ResponseB | ServiceFault;

export interface RequestB {
    requestHeader: RequestHeader;
    schema: TypeSchemaBase;
    securityMode: MessageSecurityMode;
}

export type Request = RequestB | CloseSecureChannelRequest;

export { ICertificateKeyPairProvider } from "node-opcua-common";

export function extractFirstCertificateInChain(certificateChain?: Buffer | null): Buffer | null {
    if (!certificateChain || certificateChain.length === 0) {
        return null;
    }
    const c =  split_der(certificateChain);
    return c[0];
}
export function getThumbprint(certificateChain: Buffer|null): Buffer | null {
    if (!certificateChain) {
        return null;
    }
    return makeSHA1Thumbprint(extractFirstCertificateInChain(certificateChain)!);
}
