/**
 * @module node-opcua-secure-channel
 */
import { makeSHA1Thumbprint, split_der } from "node-opcua-crypto/web";
import type { CommonInterface } from "node-opcua-factory";
import type {
    CloseSecureChannelRequest,
    MessageSecurityMode,
    RequestHeader,
    ResponseHeader
} from "node-opcua-service-secure-channel";
import type { ServiceFault } from "./services";

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

export function extractFirstCertificateInChain(certificateChain?: Buffer | Buffer[] | null): Buffer | null {
    if (!certificateChain || certificateChain.length === 0) {
        return null;
    }
    if (Array.isArray(certificateChain)) {
        return certificateChain[0];
    }
    const c = split_der(certificateChain);
    return c[0];
}
export function getThumbprint(certificateChain: Buffer | Buffer[] | null): Buffer | null {
    if (!certificateChain) {
        return null;
    }
    const firstCertificate = extractFirstCertificateInChain(certificateChain);
    if (!firstCertificate) {
        return null;
    }
    return makeSHA1Thumbprint(firstCertificate);
}
