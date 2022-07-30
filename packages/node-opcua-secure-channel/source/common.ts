/**
 * @module node-opcua-secure-channel
 */
import { makeSHA1Thumbprint, split_der } from "node-opcua-crypto";
import { CommonInterface } from "node-opcua-factory";
import { CloseSecureChannelRequest, MessageSecurityMode, RequestHeader, ResponseHeader } from "node-opcua-service-secure-channel";
import { ServiceFault } from "./services";

export interface IResponseBase {
    responseHeader: ResponseHeader;
    schema: CommonInterface;
}

export type Response = IResponseBase | ServiceFault;

export interface IRequestBase {
    requestHeader: RequestHeader;
    schema: CommonInterface;
    securityMode: MessageSecurityMode;
}

export type Request = IRequestBase | CloseSecureChannelRequest;

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
