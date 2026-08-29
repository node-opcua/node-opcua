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
import type { ServiceFault } from "./services.js";

export interface IResponseBase {
    responseHeader: ResponseHeader;
    schema: CommonInterface;
    binaryStoreSize(): number;
}

export type Response = IResponseBase | ServiceFault;

export interface IRequestBase {
    requestHeader: RequestHeader;
    schema: CommonInterface;
    securityMode: MessageSecurityMode;
    binaryStoreSize(): number;
}

export type Request = IRequestBase | CloseSecureChannelRequest;

/**
 * the Error raised by the client secure channel layer when the server answers with a ServiceFault.
 *
 * A ServiceFault is a genuine answer from the server: the request/response round trip completed.
 * The channel reports it as an Error - so that `err` and `response` stay mutually exclusive in a
 * transaction callback - and moves the decoded fault onto `response` here. Code that needs to tell
 * "the server said no" apart from "the server never answered" must therefore look at `err.response`,
 * not at the `response` argument of the callback.
 *
 * `serviceDiagnostics` and `diagnosticsInfo` are attached further up, by the session layer.
 */
export interface ServiceFaultAnnotatedError extends Error {
    response?: Response;
    request?: Request;
    serviceDiagnostics?: unknown;
    diagnosticsInfo?: unknown;
}

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
