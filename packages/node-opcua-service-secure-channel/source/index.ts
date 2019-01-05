/**
 * @module node-opcua-service-secure-channel
 */
// tslint:disable:max-line-length
import { assert } from "node-opcua-assert";
import { AsymmetricAlgorithmSecurityHeader } from "./AsymmetricAlgorithmSecurityHeader";
import { SymmetricAlgorithmSecurityHeader } from "./SymmetricAlgorithmSecurityHeader";

import {
    _enumerationMessageSecurityMode,
    ChannelSecurityToken,
    CloseSecureChannelRequest,
    CloseSecureChannelResponse,
    MessageSecurityMode,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    RequestHeader,
    ResponseHeader,
    SecurityTokenRequestType,
    ServiceFault,
    SignatureData,
    UserTokenPolicy
} from "node-opcua-types";

export {
    ChannelSecurityToken,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    CloseSecureChannelRequest,
    CloseSecureChannelResponse,
    ServiceFault,

    SecurityTokenRequestType,
    ResponseHeader,
    RequestHeader,
    SignatureData,
    MessageSecurityMode,
    _enumerationMessageSecurityMode,
    UserTokenPolicy
} from "node-opcua-types";

export { AsymmetricAlgorithmSecurityHeader } from "./AsymmetricAlgorithmSecurityHeader";
export { SymmetricAlgorithmSecurityHeader } from "./SymmetricAlgorithmSecurityHeader";
export * from "./message_security_mode";

// createdAt
ChannelSecurityToken.schema.fields[2].defaultValue =  () => new Date();
// revisedLifetime
ChannelSecurityToken.schema.fields[3].defaultValue =  () => 30000;

export function hasTokenExpired(token: ChannelSecurityToken): boolean {

    return (token.createdAt !== null)
        && (token.createdAt.getTime() + token.revisedLifetime) < Date.now();
}

Object.defineProperty(ChannelSecurityToken.prototype, "expired", {
    get() { return hasTokenExpired(this as ChannelSecurityToken); },
    configurable: true,
    enumerable: true,
});

// ErrorMessage
// "Error",  "UInt32","The numeric code for the error. This shall be one of the values listed in Table 40."
// "Reason","String", "A more verbose description of the error.This string shall not be more than 4096 characters."

// OPC Unified Architecture, Part 4  $7.27 page 139
// RequestHeader",
// 0.  authenticationToken         NodeId         The secret Session identifier used to verify that the request is associated with
//                                                the Session. The SessionAuthenticationToken type is defined in 7.29.
// 1. timestamp                   UtcTime         The time the Client sent the request.
assert(RequestHeader.schema.fields[1].name === "timestamp");
RequestHeader.schema.fields[1].defaultValue = () => new Date();
// 2. requestHandle               IntegerId "     A requestHandle associated with the request. This client defined handle can
//                                                be used to cancel the request. It is also returned in the response.
assert(RequestHeader.schema.fields[2].name === "requestHandle");
RequestHeader.schema.fields[2].defaultValue = 0xDEADBEEF;
// 3. returnDiagnostics           UInt32          A bit mask that identifies the types of vendor-specific diagnostics to be
//                                                returned in diagnosticInfo response parameters.
// 4. auditEntryId                UAString        An identifier that identifies the Client's security audit log entry associated with
//                                                this request.
// 5. timeoutHint                UInt32
// 6.  additionalHeader          ExtensionObject
assert(RequestHeader.schema.fields[6].name === "additionalHeader");
RequestHeader.schema.fields[6].defaultValue = () => null;

// OPC Unified Architecture, Part 4  $7.27 page 139
// Response Header,
// 0. timestamp                 UtcTime           The time the Server sent the response.
assert(ResponseHeader.schema.fields[0].name === "timestamp");
ResponseHeader.schema.fields[0].defaultValue = () => new Date() ;
// 1. requestHandle             IntegerId          The requestHandle given by the Client to the request.
// 2. serviceResult             StatusCode         OPC UA-defined result of the Service invocation.
// 3. serviceDiagnostics        DiagnosticInfo     The diagnostics associated with the ServiceResult.
// 4. stringTable               String[]           There is one string in this list for each unique namespace, symbolic identifier,
//                                                 and localized text string contained in all of the diagnostics information
//                                                 parameters contained in the response (see 7.8). Each is identified within this
//                                                 table by its zero-based index.
// 5. additionalHeader          ExtensionObject    Reserved for future use.

// OpenSecureChannelResponse
// documentation excerpt:
// SecurityTokens have a finite lifetime negotiated with this Service. However, differences between the
// system clocks on different machines and network latencies mean that valid Messages could arrive after the token has
// expired. To prevent valid Messages from being discarded, the applications should do the following:
// 1.  Clients should request a new SecurityTokens after 75% of its lifetime has elapsed. This should ensure that Clients
//     will receive the new SecurityToken before the old one actually expires.
// 2.  Servers should use the existing SecurityToken to secure outgoing  Messages until the SecurityToken expires or the
//     Server receives a Message secured with a new SecurityToken.
//     This should ensure that Clients do not reject Messages secured with the new SecurityToken that arrive before
//     the Client receives the new SecurityToken.
// 3.  Clients should accept Messages secured by an expired SecurityToken for up to 25% of the token lifetime.
//     This should ensure that  Messages sent by the Server before the token expired are not rejected because of
//     network delays.

// Node-opcua raised a issue in mantis => issue 2895
// BUG: the specification 1.02 says in part 4 $7.30
//   SignatureData  is "signature" + "algorithm"
//   however the schema file specifies:   "algorithm" + "signature" , Schema file is correct
// SignatureData
//   algorithm          String      The cryptography algorithm used to create the signature.
assert(SignatureData.schema.fields[0].name === "algorithm");
SignatureData.schema.fields[0].defaultValue = () => null;
//  signature           ByteString   The digital signature.
assert(SignatureData.schema.fields[1].name === "signature");
SignatureData.schema.fields[1].defaultValue = () => null;
