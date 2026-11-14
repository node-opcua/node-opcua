/**
 * @module node-opcua-server
 */
import fs from "node:fs";
import path from "node:path";
import { callbackify, types } from "node:util";
import chalk from "chalk";
import { ensureDatatypeExtracted, innerBrowse, innerBrowseNext, SessionContext } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { getDefaultCertificateManager } from "node-opcua-certificate-manager";
import { DiskCertificateKeyPairProvider, OpaqueCertificateKeyPairProvider, ResolvedCertificateKeyPairProvider, ServerState } from "node-opcua-common";
import { combine_der, exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { AttributeIds, DiagnosticInfo, filterDiagnosticOperationLevel, filterDiagnosticServiceLevel, LocalizedText, NodeClass, RESPONSE_DIAGNOSTICS_MASK_ALL } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, dump, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { extractFullyQualifiedDomainName, getFullyQualifiedDomainName, isIPAddress } from "node-opcua-hostname";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { asymmetricDecryptWithKeyOps, coerceSecurityPolicy, computeSignature, computeSignatureAsync, forgetEncodedNodesToWrite, fromURI, getCryptoFactory, MAX_NONCE_LENGTH, MessageSecurityMode, nonceAlreadyBeenUsed, SecurityPolicy, verifySignature } from "node-opcua-secure-channel";
import { BrowseNextRequest, BrowseNextResponse, BrowseRequest, BrowseResponse } from "node-opcua-service-browse";
import { CallRequest, CallResponse } from "node-opcua-service-call";
import { ApplicationType, UserTokenType } from "node-opcua-service-endpoints";
import { HistoryReadRequest, HistoryReadResponse, HistoryUpdateResponse } from "node-opcua-service-history";
import { AddNodesResponse, AddReferencesResponse, DeleteNodesResponse, DeleteReferencesResponse } from "node-opcua-service-node-management";
import { QueryFirstResponse, QueryNextResponse } from "node-opcua-service-query";
import { ReadResponse, ReadValueId, TimestampsToReturn } from "node-opcua-service-read";
import { RegisterNodesRequest, RegisterNodesResponse, UnregisterNodesRequest, UnregisterNodesResponse } from "node-opcua-service-register-node";
import { ActivateSessionRequest, ActivateSessionResponse, AnonymousIdentityToken, CloseSessionRequest, CloseSessionResponse, CreateSessionRequest, CreateSessionResponse, UserNameIdentityToken, X509IdentityToken } from "node-opcua-service-session";
import { CreateMonitoredItemsRequest, CreateMonitoredItemsResponse, CreateSubscriptionRequest, CreateSubscriptionResponse, DeleteMonitoredItemsRequest, DeleteMonitoredItemsResponse, DeleteSubscriptionsRequest, DeleteSubscriptionsResponse, ModifyMonitoredItemsRequest, ModifyMonitoredItemsResponse, ModifySubscriptionRequest, ModifySubscriptionResponse, MonitoredItemModifyResult, PublishRequest, PublishResponse, RepublishRequest, RepublishResponse, SetMonitoringModeRequest, SetMonitoringModeResponse, SetPublishingModeRequest, SetPublishingModeResponse, SetTriggeringRequest, SetTriggeringResponse, TransferSubscriptionsRequest, TransferSubscriptionsResponse } from "node-opcua-service-subscription";
import { TranslateBrowsePathsToNodeIdsRequest, TranslateBrowsePathsToNodeIdsResponse } from "node-opcua-service-translate-browse-path";
import { WriteRequest, WriteResponse } from "node-opcua-service-write";
import { coerceStatusCode, StatusCode, StatusCodes } from "node-opcua-status-code";
import { CancelResponse, EndpointDescription, IssuedIdentityToken, MonitoringMode, ServiceFault, WriteValue } from "node-opcua-types";
import { isNullOrUndefined, matchUri, randomBytes } from "node-opcua-utils";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { withCallback } from "thenify-ex";
import { OPCUABaseServer } from "./base_server.js";
import { extractPasswordFromDecryptedBlob } from "./extract_password_from_blob.js";
import { Factory } from "./factory.js";
import { leanRead } from "./lean_read.js";
import { leanWrite } from "./lean_write.js";
import { MonitoredItem } from "./monitored_item.js";
import { ensurePublishSubscribeIsBrowsable } from "./publish_subscribe_structure.js";
import { RegisterServerManager } from "./register_server_manager.js";
import { RegisterServerManagerHidden } from "./register_server_manager_hidden.js";
import { RegisterServerManagerMDNSONLY } from "./register_server_manager_mdns_only.js";
import { ReverseConnectManager } from "./reverse_connect_manager.js";
import { normalizeAdvertisedEndpoints, OPCUAServerEndPoint, parseOpcTcpUrl } from "./server_end_point.js";
import { ServerEngine } from "./server_engine.js";
import { makeUserManager } from "./user_manager.js";
import { bindRoleSet } from "./user_manager_ua.js";
function isSubscriptionIdInvalid(subscriptionId) {
    return subscriptionId < 0 || subscriptionId >= 0xffffffff;
}
const here = import.meta.dirname;
// Read rather than required: a JSON import needs an import attribute under ESM, and that
// syntax is not available while this package still emits CommonJS. A read works under both.
//
// Deliberately not wrapped in a try/catch. `require("../package.json")` threw if the manifest
// was not there, and a silent "unknown" would turn a packaging fault into a wrong version
// advertised to every client instead of a startup failure.
const packageVersion = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"))
    .version;
const debugLog = make_debugLog("opcua_server");
const doDebug = checkDebugFlag("opcua_server");
const errorLog = make_errorLog("opcua_server");
const warningLog = make_warningLog("opcua_server");
const default_maxConnectionsPerEndpoint = 10;
function g_sendError(channel, message, _ResponseClass, statusCode) {
    const response = new ServiceFault({
        responseHeader: { serviceResult: statusCode }
    });
    channel.send_response("MSG", response, message);
}
const default_build_info = {
    manufacturerName: "NodeOPCUA : MIT Licence ( see http://node-opcua.github.io/)",
    productName: "NodeOPCUA-Server",
    productUri: null, // << should be same as default_server_info.productUri?
    softwareVersion: packageVersion,
    buildNumber: "0",
    buildDate: new Date(2020, 1, 1)
    // xx buildDate: fs.statSync(package_json_file).mtime
};
const minSessionTimeout = 100; // 100 milliseconds
const defaultSessionTimeout = 1000 * 30; // 30 seconds
const maxSessionTimeout = 1000 * 60 * 50; // 50 minutes
let unnamed_session_count = 0;
function _adjust_session_timeout(sessionTimeout) {
    let revisedSessionTimeout = sessionTimeout || defaultSessionTimeout;
    revisedSessionTimeout = Math.min(revisedSessionTimeout, maxSessionTimeout);
    revisedSessionTimeout = Math.max(revisedSessionTimeout, minSessionTimeout);
    return revisedSessionTimeout;
}
function channel_has_session(channel, session) {
    // a session is on the channel it was attached to: _attach_channel and _detach_channel
    // keep channel.sessionTokens in step, and this is asked on every request
    return session.channel === channel;
}
function moveSessionToChannel(session, channel) {
    /* c8 ignore next */
    doDebug && debugLog("moveSessionToChannel sessionId", session.nodeId, " channelId=", channel.channelId);
    if (session.publishEngine) {
        session.publishEngine.cancelPendingPublishRequestBeforeChannelChange();
    }
    session._detach_channel();
    session._attach_channel(channel);
    assert(session.channel?.channelId === channel.channelId);
}
function getRequiredEndpointInfo(endpoint) {
    assert(endpoint instanceof EndpointDescription);
    // https://reference.opcfoundation.org/v104/Core/docs/Part4/5.6.2/
    // https://reference.opcfoundation.org/v105/Core/docs/Part4/5.6.2/
    const e = new EndpointDescription({
        endpointUrl: endpoint.endpointUrl,
        securityLevel: endpoint.securityLevel,
        securityMode: endpoint.securityMode,
        securityPolicyUri: endpoint.securityPolicyUri,
        server: {
            applicationUri: endpoint.server.applicationUri,
            applicationType: endpoint.server.applicationType,
            applicationName: endpoint.server.applicationName,
            productUri: endpoint.server.productUri
        },
        transportProfileUri: endpoint.transportProfileUri,
        userIdentityTokens: endpoint.userIdentityTokens
    });
    // reduce even further by explicitly setting unwanted members to null
    e.server.applicationName = new LocalizedText({ text: "" });
    // xx e.server.applicationType = null as any;
    e.server.gatewayServerUri = null;
    e.server.discoveryProfileUri = null;
    e.server.discoveryUrls = null;
    e.serverCertificate = null;
    return e;
}
// serverUri  String This value is only specified if the EndpointDescription has a gatewayServerUri.
//            This value is the applicationUri from the EndpointDescription which is the applicationUri for the
//            underlying Server. The type EndpointDescription is defined in 7.10.
function _serverEndpointsForCreateSessionResponse(server, endpointUrl, serverUri) {
    serverUri = null; // unused then
    // https://reference.opcfoundation.org/v104/Core/docs/Part4/5.6.2/
    // https://reference.opcfoundation.org/v105/Core/docs/Part4/5.6.2/
    return server
        .findMatchingEndpoints(endpointUrl)
        .filter((e) => !e.restricted) // remove restricted endpoints
        .filter((e) => matchUri(e.endpointUrl, endpointUrl))
        .map(getRequiredEndpointInfo);
}
function adjustSecurityPolicy(channel, userTokenPolicy_securityPolicyUri) {
    // check that userIdentityToken
    let securityPolicy = fromURI(userTokenPolicy_securityPolicyUri);
    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = fromURI(channel.securityPolicy);
        assert(securityPolicy !== SecurityPolicy.Invalid);
    }
    return securityPolicy;
}
function findUserTokenByPolicy(endpoint_description, userTokenType, policyId) {
    assert(endpoint_description instanceof EndpointDescription);
    if (!endpoint_description.userIdentityTokens) {
        return null;
    }
    const r = endpoint_description.userIdentityTokens.filter((userIdentity) => userIdentity.tokenType === userTokenType && (!policyId || userIdentity.policyId === policyId));
    return r.length === 0 ? null : r[0];
}
function findUserTokenPolicy(endpoint_description, userTokenType) {
    assert(endpoint_description instanceof EndpointDescription);
    if (!endpoint_description.userIdentityTokens) {
        return null;
    }
    const r = endpoint_description.userIdentityTokens.filter((userIdentity) => {
        assert(userIdentity.tokenType !== undefined);
        return userIdentity.tokenType === userTokenType;
    });
    return r.length === 0 ? null : r[0];
}
function createAnonymousIdentityToken(endpoint_desc) {
    assert(endpoint_desc instanceof EndpointDescription);
    const userTokenPolicy = findUserTokenPolicy(endpoint_desc, UserTokenType.Anonymous);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({ policyId: userTokenPolicy.policyId });
}
function sameIdentityToken(token1, token2) {
    if (!token1 && !token2) {
        return true;
    }
    if (!token1 || !token2) {
        return false;
    }
    if (token1 instanceof UserNameIdentityToken) {
        if (!(token2 instanceof UserNameIdentityToken)) {
            return false;
        }
        if (token1.userName !== token2.userName) {
            return false;
        }
        if (token1.password.toString("hex") !== token2.password.toString("hex")) {
            // note pasword hash may be different from two request and cannot be verified at this stage
            // we assume that we have a valid password
            // NOT CALLING return false;
        }
        return true;
    }
    else if (token1 instanceof AnonymousIdentityToken) {
        if (!(token2 instanceof AnonymousIdentityToken)) {
            return false;
        }
        if (token1.policyId !== token2.policyId) {
            return false;
        }
        return true;
    }
    assert(false, " Not implemented yet");
    return false;
}
/**
 * the user token types the endpoints of an OPCUAServer can advertise
 * (UserTokenType.IssuedToken has no UserTokenPolicy builder yet, see server_end_point.ts)
 */
const supportedUserTokenTypes = [
    UserTokenType.Anonymous,
    UserTokenType.UserName,
    UserTokenType.Certificate
];
/**
 * compute the user token types an endpoint advertises from the
 * `userTokenTypes` and `allowAnonymous` options.
 *
 * - `undefined` stays `undefined`, so the endpoint keeps its defaults
 *   (and still removes Anonymous when allowAnonymous is false)
 * - `allowAnonymous: false` removes Anonymous from the list
 * - unsupported token types (IssuedToken, Invalid) are ignored
 * - a list that ends up empty is a configuration error: no session could be activated
 *
 * @internal
 */
function resolveUserTokenTypes(userTokenTypes, allowAnonymous, { silent } = {}) {
    if (userTokenTypes === undefined || userTokenTypes === null) {
        return undefined;
    }
    if (!Array.isArray(userTokenTypes)) {
        throw new Error("userTokenTypes must be an array of UserTokenType");
    }
    const unsupported = userTokenTypes.filter((t) => !supportedUserTokenTypes.includes(t));
    if (unsupported.length > 0 && !silent) {
        warningLog("userTokenTypes: ignoring unsupported user token type(s)", unsupported.map((t) => UserTokenType[t] ?? t).join(", "));
    }
    let result = [...new Set(userTokenTypes.filter((t) => supportedUserTokenTypes.includes(t)))];
    if (!allowAnonymous && result.includes(UserTokenType.Anonymous)) {
        if (!silent) {
            warningLog("userTokenTypes contains UserTokenType.Anonymous but allowAnonymous is false: Anonymous is not advertised");
        }
        result = result.filter((t) => t !== UserTokenType.Anonymous);
    }
    if (result.length === 0) {
        throw new Error("userTokenTypes: no supported user token type left (after applying allowAnonymous); " +
            "no client could activate a session on this endpoint");
    }
    return result;
}
function getTokenType(userIdentityToken) {
    if (userIdentityToken instanceof AnonymousIdentityToken) {
        return UserTokenType.Anonymous;
    }
    else if (userIdentityToken instanceof UserNameIdentityToken) {
        return UserTokenType.UserName;
    }
    else if (userIdentityToken instanceof IssuedIdentityToken) {
        return UserTokenType.IssuedToken;
    }
    else if (userIdentityToken instanceof X509IdentityToken) {
        return UserTokenType.Certificate;
    }
    return UserTokenType.Invalid;
}
/**
 * The clientCertificate parameter of a CreateSession Service call (OPC 10000-4 v1.05.07 §5.7.2), normalized
 * the same way on every path that reads it: an absent or zero-length certificate becomes null,
 * never an empty Buffer. Used by both the success and the refused CreateSession audit paths so
 * they read the same value and cannot drift apart.
 */
function getRequestClientCertificate(request) {
    return request.clientCertificate && request.clientCertificate.length > 0 ? request.clientCertificate : null;
}
/**
 * OPC 10000-6 defines a certificate thumbprint as the SHA-1 hash of the DER-encoded certificate
 * (this is also how node-opcua-certificate-manager and ServerSecureChannelLayer#_prepare_response_security_header
 * compute and format every other certificate thumbprint it raises or checks). Returns null when
 * there is no certificate, never the base64 of the certificate itself.
 */
function thumbprint(certificate) {
    return certificate ? makeSHA1Thumbprint(certificate).toString("hex") : null;
}
/**
 * OPC 10000-5 v1.05.06 §6.4.2 BaseEventType / Severity:
 *
 * "Severity is an indication of the urgency of the Event. This is also commonly called
 * "priority". Values will range from 1 to 1 000, with 1 being the lowest severity and 1 000
 * being the highest. Typically, a severity of 1 would indicate an Event which is informational
 * in nature, while a value of 1 000 would indicate an Event of catastrophic nature [...] it is
 * recommended that Server developers map Events of high urgency into the OPC severity range of
 * 667 to 1 000 [...] and Events of low urgency into OPC severities of 1 to 333."
 *
 * The spec gives a range and a recommended banding, not per-EventType values, and has no
 * audit-specific guidance beyond this. These two constants are this server's own choice, used
 * by every "Audit*EventType" raised below instead of a magic number at each of the nine call
 * sites:
 *  - AUDIT_SEVERITY_INFO: a normal, successful operation (a session created, activated or
 *    closed) - informational, in the recommended 1-333 "low urgency" band.
 *  - AUDIT_SEVERITY_SECURITY_FAILURE: a security failure an operator watching audit events
 *    needs to see (an untrusted/expired/revoked/mismatched certificate, a rejected
 *    ActivateSession such as an invalid user signature, a URL mismatch) - in the recommended
 *    667-1 000 "high urgency" band.
 *
 * The CreateSession and session-closed events hardcode status = true - they are only ever raised
 * after the operation already succeeded - and the certificate / URL events are only ever reached
 * on the corresponding failure. The AuditActivateSessionEventType is raised on both outcomes, so
 * its Status and Severity follow the outcome (see raiseAuditActivateSessionEventType).
 */
const AUDIT_SEVERITY_INFO = 100;
const AUDIT_SEVERITY_SECURITY_FAILURE = 900;
/**
 * OPC 10000-5 v1.05.06 §6.4.8 AuditCreateSessionEventType:
 *
 * "The ClientUserId is not available for this call thus this parameter shall be set to the
 * 'System/CreateSession'."
 *
 * No UserIdentityToken exists yet at CreateSession time (it is only supplied in the later
 * ActivateSession call), hence the fixed literal rather than a derived value. Used at the
 * AuditCreateSessionEventType raise site of the CreateSession service below.
 */
const CLIENT_USER_ID_CREATE_SESSION = "System/CreateSession";
/**
 * OPC 10000-5 6.4.3 AuditEventType / ClientUserId:
 *
 * "The ClientUserId identifies the user of the client requesting an action. The ClientUserId
 * can be obtained from the UserIdentityToken passed in the ActivateSession call. If the
 * UserIdentityToken is a UserNameIdentityToken then the ClientUserId shall be the UserName.
 * If the UserIdentityToken is an X509IdentityToken then the ClientUserId shall be the X509
 * Subject Name of the Certificate. [...] If an AnonymousIdentityToken is being used, the
 * ClientUserId shall be null."
 *
 * Mirrors the identity classification already used for RBAC role resolution
 * (node-opcua-address-space/api/session_context.ts#getUserName), adapted to the audit
 * semantics above (anonymous -> "" rather than the literal string "anonymous").
 *
 * IssuedIdentityToken is deliberately left as "": the spec's rule for it depends on parsing
 * the token as a JWT and reading its `iss`/`sub` claims, and no tested JWT-decoding path
 * exists anywhere else in this codebase to reuse. Guessing at one here, for a security audit
 * field, risks reporting a wrong identity - which is worse than reporting none. Certificate
 * parsing is wrapped in try/catch because a malformed X509IdentityToken must not prevent the
 * audit event (or the ActivateSession response) from being raised.
 */
function getClientUserIdForAudit(userIdentityToken) {
    if (!userIdentityToken || userIdentityToken instanceof AnonymousIdentityToken) {
        return "";
    }
    if (userIdentityToken instanceof UserNameIdentityToken) {
        return typeof userIdentityToken.userName === "string" ? userIdentityToken.userName : "";
    }
    if (userIdentityToken instanceof X509IdentityToken) {
        try {
            const cert = Array.isArray(userIdentityToken.certificateData)
                ? userIdentityToken.certificateData[0]
                : userIdentityToken.certificateData;
            const certInfo = exploreCertificate(cert);
            const subjectCommonName = certInfo.tbsCertificate.subject.commonName;
            return typeof subjectCommonName === "string" ? subjectCommonName : "";
        }
        catch {
            return "";
        }
    }
    // IssuedIdentityToken or any future/unknown token type: see comment above.
    return "";
}
/*=== private
 *
 * perform the read operation on a given node for a monitored item.
 * this method DOES NOT apply to Variable Values attribute
 *
 * @param self
 * @param oldValue
 * @param node
 * @param itemToMonitor
 * @private
 */
function monitoredItem_read_and_record_value(self, context, oldValue, node, itemToMonitor, callback, _clock) {
    assert(self instanceof MonitoredItem);
    assert(oldValue instanceof DataValue);
    assert(itemToMonitor.attributeId === AttributeIds.Value);
    const dataValue = node.readAttribute(context, itemToMonitor.attributeId, itemToMonitor.indexRange, itemToMonitor.dataEncoding);
    callback(null, dataValue);
}
/*== private
 * this method applies to Variable Values attribute
 * @private
 */
function monitoredItem_read_and_record_value_async(_self, context, _oldValue, node, _itemToMonitor, callback, clock) {
    // runs on every sample of every monitored item, so it asserts nothing: it is only chosen by
    // build_scanning_node_function for the Value attribute of a node that has readValueAsync
    node.readValueAsync(context, callback, clock);
}
function build_scanning_node_function(nodeFinder, itemToMonitor) {
    assert(itemToMonitor instanceof ReadValueId);
    const node = nodeFinder.findNode(itemToMonitor.nodeId);
    /* c8 ignore next */
    if (!node) {
        errorLog(" INVALID NODE ID  , ", itemToMonitor.nodeId.toString());
        dump(itemToMonitor);
        return (_sessionContext, _oldData, callback) => {
            callback(null, new DataValue({
                statusCode: StatusCodes.BadNodeIdUnknown,
                value: { dataType: DataType.Null, value: 0 }
            }));
        };
    }
    ///// !!monitoredItem.setNode(node);
    if (itemToMonitor.attributeId === AttributeIds.Value) {
        const monitoredItem_read_and_record_value_func = itemToMonitor.attributeId === AttributeIds.Value && typeof node.readValueAsync === "function"
            ? monitoredItem_read_and_record_value_async
            : monitoredItem_read_and_record_value;
        return function func(sessionContext, oldDataValue, callback, clock) {
            monitoredItem_read_and_record_value_func(this, sessionContext, oldDataValue, node, itemToMonitor, callback, clock);
        };
    }
    else {
        // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
        // The filter is not used for these  Attributes. Any change in value for these  Attributes
        // causes a  Notification  to be  generated.
        // only record value when it has changed
        return function func(sessionContext, oldDataValue, callback) {
            assert(this instanceof MonitoredItem);
            assert(oldDataValue instanceof DataValue);
            assert(typeof callback === "function");
            const newDataValue = node.readAttribute(sessionContext, itemToMonitor.attributeId);
            callback(null, newDataValue);
        };
    }
}
/**
 * the sampling function of a monitored item: a read of its node, found on the node objects or
 * on the compact address space
 * @internal exported for the engine tests
 */
export function prepareMonitoredItem(_context, nodeFinder, monitoredItem) {
    // MonitoredItem.itemToMonitor is always constructed as a real ReadValueId instance (see defaultItemToMonitor
    // in monitored_item.ts), even though its declared type is the looser ReadValueIdOptions
    const itemToMonitor = monitoredItem.itemToMonitor;
    const readNodeFunc = build_scanning_node_function(nodeFinder, itemToMonitor);
    monitoredItem.samplingFunc = readNodeFunc;
}
function isMonitoringModeValid(monitoringMode) {
    assert(MonitoringMode.Invalid !== undefined);
    return monitoringMode !== MonitoringMode.Invalid && monitoringMode <= MonitoringMode.Reporting;
}
function _installRegisterServerManager(self) {
    assert(self instanceof OPCUAServerCore);
    assert(!self.registerServerManager);
    /* c8 ignore next */
    if (!self.registerServerMethod) {
        throw new Error("Internal Error");
    }
    switch (self.registerServerMethod) {
        case RegisterServerMethod.HIDDEN:
            self.registerServerManager = new RegisterServerManagerHidden({
                server: self
            });
            break;
        case RegisterServerMethod.MDNS:
            self.registerServerManager = new RegisterServerManagerMDNSONLY({
                server: self
            });
            break;
        case RegisterServerMethod.LDS:
            self.registerServerManager = new RegisterServerManager({
                discoveryServerEndpointUrl: self.discoveryServerEndpointUrl,
                server: self
            });
            break;
        /* c8 ignore next */
        default:
            throw new Error("Invalid switch");
    }
    self.registerServerManager.on("serverRegistrationPending", () => {
        /**
         * emitted when the server is trying to registered the LDS
         * but when the connection to the lds has failed
         * serverRegistrationPending is sent when the backoff signal of the
         * connection process is raised
         * @event serverRegistrationPending
         */
        /* c8 ignore next */
        doDebug && debugLog("serverRegistrationPending");
        self.emit("serverRegistrationPending");
    });
    self.registerServerManager.on("serverRegistered", () => {
        /**
         * emitted when the server is successfully registered to the LDS
         * @event serverRegistered
         */
        /* c8 ignore next */
        doDebug && debugLog("serverRegistered");
        self.emit("serverRegistered");
    });
    self.registerServerManager.on("serverRegistrationRenewed", () => {
        /**
         * emitted when the server has successfully renewed its registration to the LDS
         * @event serverRegistrationRenewed
         */
        /* c8 ignore next */
        doDebug && debugLog("serverRegistrationRenewed");
        self.emit("serverRegistrationRenewed");
    });
    self.registerServerManager.on("serverUnregistered", () => {
        /* c8 ignore next */
        doDebug && debugLog("serverUnregistered");
        /**
         * emitted when the server is successfully unregistered to the LDS
         * ( for instance during shutdown)
         * @event serverUnregistered
         */
        self.emit("serverUnregistered");
    });
}
function validate_applicationUri(channel, request) {
    const applicationUri = request.clientDescription.applicationUri || "";
    const clientCertificate = request.clientCertificate;
    // if session is insecure there is no need to check certificate information
    if (channel.securityMode === MessageSecurityMode.None) {
        return true; // assume correct
    }
    if (!clientCertificate || clientCertificate.length === 0) {
        return true; // can't check
    }
    const e = exploreCertificate(clientCertificate);
    const uniformResourceIdentifier = e.tbsCertificate.extensions?.subjectAltName?.uniformResourceIdentifier ?? null;
    const applicationUriFromCert = uniformResourceIdentifier && uniformResourceIdentifier.length > 0 ? uniformResourceIdentifier[0] : null;
    /* c8 ignore next */
    if (applicationUriFromCert !== applicationUri) {
        errorLog("BadCertificateUriInvalid!");
        errorLog("applicationUri           = ", applicationUri);
        errorLog("applicationUriFromCert   = ", applicationUriFromCert);
    }
    return applicationUriFromCert === applicationUri;
}
/**
 * Raises the AuditCreateSessionEventType of a refused CreateSession call.
 *
 * OPC 10000-5 v1.05.06 §6.4.8: SourceName "Session/CreateSession"; "The ClientUserId is not available for
 * this call thus this parameter shall be set to the 'System/CreateSession'"; ClientCertificate "is
 * the clientCertificate parameter of the CreateSession Service call". 6.4.7: "If no session context
 * exists (e.g. for a failed CreateSession Service call) the SessionId shall be null." The
 * RevisedSessionTimeout "is the returned revisedSessionTimeout parameter", and a refused call returns
 * none, so it stays null.
 */
function raiseAuditCreateSessionFailure(server, request, channel, statusCode) {
    if (!server.isAuditing) {
        return;
    }
    const clientCertificate = getRequestClientCertificate(request);
    server.raiseEvent("AuditCreateSessionEventType", {
        /* OPC 10000-5 v1.05.06 §6.4.3 AuditEventType */
        actionTimeStamp: { dataType: "DateTime", value: new Date() },
        status: { dataType: "Boolean", value: false },
        severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
        // OPC 10000-4 v1.05.07 §6.5.6: "For the failure case the Message for Events of this type should
        // include a description of why the Service failed."
        message: { dataType: "LocalizedText", value: { text: `CreateSession rejected: ${statusCode.name}` } },
        serverId: { dataType: "String", value: server.serverInfo.applicationUri || "" },
        clientAuditEntryId: { dataType: "String", value: request.requestHeader.auditEntryId ?? "" },
        clientUserId: { dataType: "String", value: CLIENT_USER_ID_CREATE_SESSION },
        sourceName: { dataType: "String", value: "Session/CreateSession" },
        /* OPC 10000-5 v1.05.06 §6.4.7 AuditSessionEventType */
        sessionId: { dataType: "NodeId", value: new NodeId() },
        /* OPC 10000-5 v1.05.06 §6.4.8 AuditCreateSessionEventType */
        secureChannelId: { dataType: "String", value: channel.channelId?.toString() ?? "" },
        clientCertificate: { dataType: "ByteString", value: clientCertificate },
        clientCertificateThumbprint: { dataType: "String", value: thumbprint(clientCertificate) }
    });
}
function validate_security_endpoint(server, request, channel) {
    /* c8 ignore next */
    doDebug && debugLog("validate_security_endpoint = ", request.endpointUrl);
    let endpoints = server.findMatchingEndpoints(request.endpointUrl);
    // endpointUrl String The network address that the Client used to access the Session Endpoint.
    //             The HostName portion of the URL should be one of the HostNames for the application that are
    //             specified in the Server’s ApplicationInstanceCertificate (see 7.2). The Server shall raise an
    //             AuditUrlMismatchEventType event if the URL does not match the Server’s HostNames.
    //             AuditUrlMismatchEventType event type is defined in Part 5.
    //             The Server uses this information for diagnostics and to determine the set of
    //             EndpointDescriptions to return in the response.
    // ToDo: check endpointUrl validity and emit an AuditUrlMismatchEventType event if not
    // sometime endpoints have a extra leading "/" that can be ignored
    // don't be too harsh.
    let urlMatched = true;
    if (endpoints.length === 0 && request.endpointUrl?.endsWith("/")) {
        endpoints = server.findMatchingEndpoints(request.endpointUrl.slice(0, -1));
    }
    if (endpoints.length === 0) {
        // we have a UrlMismatch here
        if (!request.endpointUrl?.match(/localhost/i) || OPCUAServer.requestExactEndpointUrl) {
            warningLog("Cannot find suitable endpoints in available endpoints. endpointUri =", request.endpointUrl);
        }
        if (server.isAuditing) {
            server.raiseEvent("AuditUrlMismatchEventType", {
                severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
                endpointUrl: { dataType: DataType.String, value: request.endpointUrl }
            });
        }
        if (OPCUAServer.requestExactEndpointUrl) {
            return { errCode: StatusCodes.BadServiceUnsupported };
        }
        else {
            urlMatched = false;
            endpoints = server.findMatchingEndpoints(null);
        }
    }
    // ignore restricted endpoints
    endpoints = endpoints.filter((e) => !e.restricted);
    const endpoints_matching_security_mode = endpoints.filter((e) => {
        return e.securityMode === channel.securityMode;
    });
    if (endpoints_matching_security_mode.length === 0) {
        return { errCode: StatusCodes.BadSecurityModeRejected };
    }
    const endpoints_matching_security_policy = endpoints_matching_security_mode.filter((e) => {
        return e.securityPolicyUri === channel?.securityPolicy;
    });
    if (endpoints_matching_security_policy.length === 0) {
        return { errCode: StatusCodes.BadSecurityPolicyRejected };
    }
    if (endpoints_matching_security_policy.length !== 1) {
        /* c8 ignore next */
        doDebug && debugLog("endpoints_matching_security_policy= ", endpoints_matching_security_policy.length);
    }
    const securityCheck = checkChannelSecurityOnListener(endpoints_matching_security_policy[0], urlMatched, channel);
    if (securityCheck.isNotGood()) {
        warningLog("CreateSession endpointUrl", request.endpointUrl, "does not identify an endpoint of this channel's listener, and not every URL of this listener accepts", MessageSecurityMode[channel.securityMode], channel.securityPolicy, "=>", securityCheck.toString());
        return { errCode: securityCheck };
    }
    return {
        errCode: StatusCodes.Good,
        endpoint: bindSessionEndpoint(endpoints_matching_security_policy[0], urlMatched, endpoints_matching_security_policy, channel)
    };
}
/** the listener (OPCUAServerEndPoint) the secure channel arrived on, when known */
function channelListener(channel) {
    const own = channel.getEndpointDescription(channel.securityMode, fromURI(channel.securityPolicy), null);
    return own?._parent;
}
/**
 * The security mode and policy counterpart of {@link bindSessionEndpoint}.
 *
 * Every URL of a listener shares its socket, so the listener accepts a secure
 * channel with any mode and policy that one of its URLs offers. When the
 * CreateSession endpointUrl identifies an endpoint of the channel's own listener,
 * validate_security_endpoint already checked the channel against that URL.
 * Otherwise (unknown URL, or URL of another listener) the channel must use a mode
 * and policy offered by EVERY URL of its listener, the most restrictive common set.
 *
 * Status codes, as for a matched URL: BadSecurityModeRejected when some URL does not
 * offer the channel's security mode at all, else BadSecurityPolicyRejected.
 *
 * Without per-URL differences every URL offers the same set: always Good.
 * @internal
 */
function checkChannelSecurityOnListener(chosen, urlMatched, channel) {
    const listener = channelListener(channel);
    if (!listener) {
        return StatusCodes.Good;
    }
    if (urlMatched && chosen._parent === listener) {
        return StatusCodes.Good;
    }
    const byUrl = new Map();
    for (const e of listener.endpointDescriptions()) {
        if (e.restricted) {
            continue;
        }
        const url = (e.endpointUrl || "").toLowerCase();
        byUrl.set(url, [...(byUrl.get(url) || []), e]);
    }
    let result = StatusCodes.Good;
    for (const endpoints of byUrl.values()) {
        const sameMode = endpoints.filter((e) => e.securityMode === channel.securityMode);
        if (sameMode.length === 0) {
            return StatusCodes.BadSecurityModeRejected;
        }
        if (!sameMode.some((e) => e.securityPolicyUri === channel.securityPolicy)) {
            result = StatusCodes.BadSecurityPolicyRejected;
        }
    }
    return result;
}
function userTokenTypesOf(endpoint) {
    return new Set((endpoint.userIdentityTokens || []).map((t) => t.tokenType));
}
/**
 * Choose the EndpointDescription a new Session is bound to, so that the user
 * token types accepted at ActivateSession never depend on a claim the server
 * cannot verify.
 *
 * The endpointUrl of CreateSession is supplied by the Client (OPC 10000-4 5.7.2:
 * "The network address that the Client used to access the Session Endpoint",
 * used "for diagnostics and to determine the set of EndpointDescriptions to
 * return"). Only the listener (TCP socket) the SecureChannel arrived on is a
 * fact. Therefore:
 *
 * - URL matched an endpoint of the channel's own listener: that endpoint is used,
 *   unchanged (its userIdentityTokens are enforced by ActivateSession).
 * - URL matched nothing (fallback), or matched an endpoint of ANOTHER listener:
 *   the accepted token types are limited to the intersection of the token types
 *   of all endpoints of the channel's listener with the same security mode and
 *   policy, i.e. the most restrictive one the client could have reached.
 *
 * When this limitation removes nothing (no per-URL / per-listener differences),
 * the chosen endpoint is returned as is: same object as before this rule existed.
 * Otherwise a copy of it with the filtered userIdentityTokens is returned; its
 * policyIds are kept so that a client that picked the same endpoint still matches.
 *
 * @internal
 */
function bindSessionEndpoint(chosen, urlMatched, candidates, channel) {
    const listener = channelListener(channel);
    const chosenOnListener = !listener || chosen._parent === listener;
    if (urlMatched && chosenOnListener) {
        return chosen;
    }
    let peers = listener
        ? listener
            .endpointDescriptions()
            .filter((e) => !e.restricted &&
            e.securityMode === channel.securityMode &&
            e.securityPolicyUri === channel.securityPolicy)
        : candidates;
    if (peers.length === 0) {
        peers = candidates;
    }
    const allowed = userTokenTypesOf(chosen);
    for (const peer of peers) {
        const peerTypes = userTokenTypesOf(peer);
        for (const t of [...allowed]) {
            if (!peerTypes.has(t)) {
                allowed.delete(t);
            }
        }
    }
    const chosenTokens = chosen.userIdentityTokens || [];
    if (chosenTokens.every((t) => allowed.has(t.tokenType))) {
        return chosen;
    }
    warningLog("CreateSession endpointUrl", urlMatched ? "belongs to another listener" : "matches no endpoint", "of this channel: user token types limited to", [...allowed].map((t) => UserTokenType[t]).join(", ") || "(none)");
    const derived = new EndpointDescription({
        endpointUrl: chosen.endpointUrl,
        server: chosen.server,
        serverCertificate: chosen.serverCertificate,
        securityMode: chosen.securityMode,
        securityPolicyUri: chosen.securityPolicyUri,
        userIdentityTokens: chosenTokens.filter((t) => allowed.has(t.tokenType)),
        transportProfileUri: chosen.transportProfileUri,
        securityLevel: chosen.securityLevel
    });
    derived._parent = chosen._parent;
    derived.restricted = false;
    return derived;
}
/** the operation-level bits of RequestHeader.returnDiagnostics (OPC 10000-4 v1.05.07 §7.33) */
const OPERATION_LEVEL_DIAGNOSTICS = 0x3e0;
/** the operation-level SymbolicId bit of RequestHeader.returnDiagnostics (OPC 10000-4 v1.05.07 §7.32) */
const OPERATION_LEVEL_SYMBOLIC_ID = 0x20;
/** the operation-level LocalizedText bit of RequestHeader.returnDiagnostics (OPC 10000-4 v1.05.07 §7.32) */
const OPERATION_LEVEL_LOCALIZED_TEXT = 0x40;
/** the namespace of the StatusCodes OPC 10000-6 defines: the namespace of a StatusCode's symbolic id */
const OPC_UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";
/** OPC 10000-4 v1.05.07 §7.12: "up to 256 bytes of localized text" */
const MAX_LOCALIZED_TEXT_BYTES = 256;
/** `text` cut to at most `maxBytes` of UTF-8, never in the middle of a character */
function truncateUtf8(text, maxBytes) {
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return text;
    }
    let bytes = 0;
    let end = 0;
    for (const char of text) {
        const size = Buffer.byteLength(char, "utf8");
        if (bytes + size > maxBytes) {
            break;
        }
        bytes += size;
        end += char.length;
    }
    return text.slice(0, end);
}
/** the index of `value` in `stringTable`, added when absent: one entry per unique string (OPC 10000-4 v1.05.07 §7.33) */
function stringIndex(stringTable, value) {
    const index = stringTable.indexOf(value);
    return index >= 0 ? index : stringTable.push(value) - 1;
}
/**
 * OPC 10000-4 v1.05.07 §5.12.2: CallResponse.diagnosticInfos, one per result, in the order of the results. Empty unless
 * the Client asked for operation-level diagnostics and at least one result has something to report.
 *
 * Each entry starts from the DiagnosticInfo the method implementation returned. When `stringTable` is given, the
 * fields §7.12 defines as indexes into the ResponseHeader stringTable are filled for every non-Good result, according
 * to the bits the Client asked for (§7.32):
 * - SymbolicId (0x20): `symbolicId` is the symbolic name of the StatusCode, `namespaceURI` the OPC UA namespace it is
 *   defined in;
 * - LocalizedText (0x40): `localizedText` is the method's `statusText` (at most 256 bytes of UTF-8), else the standard
 *   description of the StatusCode; `locale` is the locale of `statusText`, when given.
 * A field the method already set is kept. A Good result gets only what its method returned, or its `statusText`.
 */
export function callResultDiagnosticInfos(returnDiagnostics, results, stringTable) {
    if (!(returnDiagnostics & OPERATION_LEVEL_DIAGNOSTICS)) {
        return [];
    }
    const wantSymbolicId = stringTable !== undefined && (returnDiagnostics & OPERATION_LEVEL_SYMBOLIC_ID) !== 0;
    const wantText = stringTable !== undefined && (returnDiagnostics & OPERATION_LEVEL_LOCALIZED_TEXT) !== 0;
    let reported = false;
    const diagnosticInfos = results.map((r) => {
        const diagnosticInfo = new DiagnosticInfo(r.diagnosticInfo ?? {});
        reported = reported || r.diagnosticInfo !== undefined;
        const statusCode = r.statusCode ? coerceStatusCode(r.statusCode) : StatusCodes.Good;
        const notGood = statusCode.isNotGood();
        if (wantSymbolicId && notGood && !(diagnosticInfo.symbolicId >= 0)) {
            diagnosticInfo.symbolicId = stringIndex(stringTable, statusCode.name);
            diagnosticInfo.namespaceURI = stringIndex(stringTable, OPC_UA_NAMESPACE_URI);
            reported = true;
        }
        if (wantText && !(diagnosticInfo.localizedText >= 0)) {
            const statusText = typeof r.statusText === "string" ? { text: r.statusText } : r.statusText;
            const text = statusText?.text || (notGood ? statusCode.description : "");
            if (text) {
                diagnosticInfo.localizedText = stringIndex(stringTable, truncateUtf8(text, MAX_LOCALIZED_TEXT_BYTES));
                if (statusText?.locale) {
                    diagnosticInfo.locale = stringIndex(stringTable, statusText.locale);
                }
                reported = true;
            }
        }
        return diagnosticInfo;
    });
    return reported ? diagnosticInfos : [];
}
export function filterDiagnosticInfo(returnDiagnostics, response) {
    if (RESPONSE_DIAGNOSTICS_MASK_ALL & returnDiagnostics) {
        response.responseHeader.serviceDiagnostics = filterDiagnosticServiceLevel(returnDiagnostics, response.responseHeader.serviceDiagnostics);
        if (response.diagnosticInfos && response.diagnosticInfos.length > 0) {
            response.diagnosticInfos = response.diagnosticInfos.map((d) => filterDiagnosticOperationLevel(returnDiagnostics, d));
        }
        else {
            response.diagnosticInfos = [];
        }
        if (response.results) {
            for (const entry of response.results) {
                if (entry.inputArgumentDiagnosticInfos && entry.inputArgumentDiagnosticInfos.length > 0) {
                    entry.inputArgumentDiagnosticInfos = entry.inputArgumentDiagnosticInfos.map((d) => filterDiagnosticOperationLevel(returnDiagnostics, d));
                }
                else {
                    entry.inputArgumentDiagnosticInfos = [];
                }
            }
        }
    }
}
export var RegisterServerMethod;
(function (RegisterServerMethod) {
    RegisterServerMethod[RegisterServerMethod["HIDDEN"] = 1] = "HIDDEN";
    RegisterServerMethod[RegisterServerMethod["MDNS"] = 2] = "MDNS";
    RegisterServerMethod[RegisterServerMethod["LDS"] = 3] = "LDS"; // the server registers itself to the LDS or LDS-ME (Local Discovery Server)
})(RegisterServerMethod || (RegisterServerMethod = {}));
const g_requestExactEndpointUrl = !!process.env.NODEOPCUA_SERVER_REQUEST_EXACT_ENDPOINT_URL;
/**
 * The OPC UA server.
 *
 * `OPCUAServer` creates an OPC UA server that exposes an address space
 * to connected clients. It handles secure channel management, session
 * lifecycle, subscriptions, and the full OPC UA service set.
 *
 * @example
 * ```typescript
 * import { OPCUAServer, DataType, Variant } from "node-opcua";
 *
 * const server = new OPCUAServer({ port: 26543 });
 * await server.initialize();
 *
 * const addressSpace = server.engine.addressSpace!;
 * const namespace = addressSpace.getOwnNamespace();
 * const myVariable = namespace.addVariable({
 *     browseName: "Temperature",
 *     componentOf: addressSpace.rootFolder.objects,
 *     dataType: DataType.Double,
 * });
 * myVariable.setValueFromSource(
 *     new Variant({ dataType: DataType.Double, value: 22.5 })
 * );
 *
 * await server.start();
 * console.log("Server listening on",
 *     server.getEndpointUrl());
 *
 * // ... later ...
 * await server.shutdown();
 * ```
 */
/**
 * The services of an OPC UA server over an engine: the ServerEngine of this thread for an OPCUAServer, or one
 * that forwards to an engine elsewhere. What the services ask of the engine is IServerEngineForServer.
 * The static settings (OPCUAServer.defaultShutdownTimeout, ...) are read from OPCUAServer, where users set them.
 */
export class OPCUAServerCore extends OPCUABaseServer {
    engine;
    registerServerMethod;
    discoveryServerEndpointUrl;
    registerServerManager;
    capabilitiesForMDNS;
    userCertificateManager;
    /** Reverse Connect driver, created only when `options.reverseConnect` is provided. @internal */
    #reverseConnectManager;
    /** Set once shutdown() has been requested; lets repeated/concurrent calls share one outcome instead of racing. @internal */
    #shutdownPromise;
    toJSON() {
        return {
            serverInfo: this.serverInfo,
            buildInfo: this.buildInfo,
            state: this.engine ? this.getServerState() : "uninitialized",
            endpoints: this.endpoints.map((e) => e.toJSON()),
            currentSessionCount: this.currentSessionCount,
            initialized: this.initialized
        };
    }
    toString() {
        return `OPCUAServer(endpoints=${this.endpoints.map((e) => e.toString()).join(",")})`;
    }
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
    /**
     * total number of bytes written  by the server since startup
     */
    get bytesWritten() {
        return this.endpoints.reduce((accumulated, endpoint) => {
            return accumulated + endpoint.bytesWritten;
        }, 0);
    }
    /**
     * total number of bytes read  by the server since startup
     */
    get bytesRead() {
        return this.endpoints.reduce((accumulated, endpoint) => {
            return accumulated + endpoint.bytesRead;
        }, 0);
    }
    /**
     * Number of transactions processed by the server since startup
     */
    get transactionsCount() {
        return this.endpoints.reduce((accumulated, endpoint) => {
            return accumulated + endpoint.transactionsCount;
        }, 0);
    }
    /**
     * The server build info
     */
    get buildInfo() {
        return this.engine.buildInfo;
    }
    /**
     * the number of connected channel on all existing end points
     */
    get currentChannelCount() {
        // TODO : move to base
        return this.endpoints.reduce((currentValue, endPoint) => {
            return currentValue + endPoint.currentChannelCount;
        }, 0);
    }
    /**
     * The number of active subscriptions from all sessions
     */
    get currentSubscriptionCount() {
        return this.engine ? this.engine.currentSubscriptionCount : 0;
    }
    /**
     * the number of session activation requests that have been rejected
     */
    get rejectedSessionCount() {
        return this.engine ? this.engine.rejectedSessionCount : 0;
    }
    /**
     * the number of request that have been rejected
     */
    get rejectedRequestsCount() {
        return this.engine ? this.engine.rejectedRequestsCount : 0;
    }
    /**
     * the number of sessions that have been aborted
     */
    get sessionAbortCount() {
        return this.engine ? this.engine.sessionAbortCount : 0;
    }
    /**
     * the publishing interval count
     */
    get publishingIntervalCount() {
        return this.engine ? this.engine.publishingIntervalCount : 0;
    }
    /**
     * the number of sessions currently active
     */
    get currentSessionCount() {
        return this.engine ? this.engine.currentSessionCount : 0;
    }
    /**
     * true if the server has been initialized
     *
     */
    get initialized() {
        return this.engine && this.engine.addressSpace !== null;
    }
    /**
     * is the server auditing ?
     */
    get isAuditing() {
        return this.engine ? this.engine.isAuditing : false;
    }
    /**
     * Set the current server state.
     *
     * Updates both the internal state and the
     * `Server.ServerStatus.State` variable in the
     * address space so that OPC UA reads reflect the
     * new state immediately.
     */
    setServerState(serverState) {
        this.engine.setServerState(serverState);
    }
    /**
     * Read the current `ServerState` from the
     * internal server status.
     */
    getServerState() {
        return this.engine.getServerState();
    }
    /**
     * Set or clear a temporary role-policy override.
     *
     * When set, the override's `getUserRoles(username)`
     * is called **before** the default `userManager`.
     * Returning a `NodeId[]` overrides the roles;
     * returning `null` falls through to the default.
     *
     * Call with `null` to remove the override and
     * restore default behavior.
     */
    setRolePolicyOverride(override) {
        this.rolePolicyOverride = override;
    }
    /**
     * Set `ServerConfiguration.InApplicationSetup` in
     * the address space.
     *
     * Indicates whether the server is in its initial
     * application setup phase (e.g. awaiting GDS
     * provisioning).
     */
    setInApplicationSetup(value) {
        this.engine.setInApplicationSetup(value);
    }
    /**
     * Read the current value of
     * `ServerConfiguration.InApplicationSetup`.
     */
    getInApplicationSetup() {
        return this.engine.getInApplicationSetup();
    }
    /**
     * Collect additional hostnames for the self-signed certificate SAN.
     *
     * Merges hostnames from `alternateHostname` and parsed
     * `advertisedEndpoints` URLs so the certificate covers all
     * configured addresses.
     *
     * IP literals (v4/v6) are **excluded** — they are handled by
     * `getConfiguredIPs()` and placed in the SAN `iPAddress` entries.
     *
     * @internal
     */
    getConfiguredHostnames() {
        return this._collectAlternateValues().hostnames;
    }
    /**
     * Collect additional IP addresses for the self-signed certificate SAN.
     *
     * Merges IP literals from `alternateHostname` and parsed
     * `advertisedEndpoints` URLs so the certificate covers all
     * configured IP addresses.
     *
     * @internal
     */
    getConfiguredIPs() {
        return this._collectAlternateValues().ips;
    }
    /**
     * Classify all values from `alternateHostname` and
     * `advertisedEndpoints` into hostnames vs IP addresses using
     * `isIPAddress()` (wraps `net.isIP()`).
     */
    _collectAlternateValues() {
        const hostnames = [];
        const ips = [];
        // alternateHostname
        const alt = this.options.alternateHostname;
        if (alt) {
            const altArray = Array.isArray(alt) ? alt : [alt];
            for (const value of altArray) {
                if (isIPAddress(value)) {
                    ips.push(value);
                }
                else {
                    hostnames.push(value);
                }
            }
        }
        // advertisedEndpoints — normalize to AdvertisedEndpointConfig[]
        const advList = normalizeAdvertisedEndpoints(this.options.advertisedEndpoints);
        for (const config of advList) {
            const { hostname: rawHostname } = parseOpcTcpUrl(config.url);
            // URL keeps the brackets around an IPv6 literal
            const hostname = rawHostname.startsWith("[") && rawHostname.endsWith("]") ? rawHostname.slice(1, -1) : rawHostname;
            if (isIPAddress(hostname)) {
                ips.push(hostname);
            }
            else {
                hostnames.push(hostname);
            }
        }
        return { hostnames, ips };
    }
    /**
     * the maximum number of concurrent sessions allowed on the server
     */
    get maxAllowedSessionNumber() {
        return this.engine.serverCapabilities.maxSessions;
    }
    /**
     * the maximum number for concurrent connection per end point
     */
    maxConnectionsPerEndpoint;
    /**
     * false if anonymous connection are not allowed
     */
    allowAnonymous = false;
    /**
     * the user manager
     */
    userManager;
    /**
     * Additional role resolvers (OPC 10000-18 §4.4).
     * Packages like node-opcua-role-set-server push resolvers here.
     */
    roleResolvers = [];
    /**
     * how a remote Session's permission is resolved when no RolePermissions apply.
     * @default "allow"
     * @see OPCUAServerOptions.unresolvedPermissionPolicy
     */
    unresolvedPermissionPolicy;
    /**
     * true: CreateSessionResponse.serverCertificate carries the whole chain;
     * false: the leaf certificate only. Read at each CreateSession.
     * @see OPCUAServerOptions.sendCertificateChainInCreateSession
     */
    sendCertificateChainInCreateSession;
    options;
    objectFactory;
    _delayInit;
    constructor(options) {
        super(options);
        this.allowAnonymous = false;
        options = options || {};
        this.options = options;
        if (options.maxAllowedSessionNumber !== undefined) {
            warningLog("[NODE-OPCUA-W21] maxAllowedSessionNumber property is now deprecated , please use serverCapabilities.maxSessions instead");
            options.serverCapabilities = options.serverCapabilities || {};
            options.serverCapabilities.maxSessions = options.maxAllowedSessionNumber;
        }
        // adjust securityPolicies if any
        if (options.securityPolicies) {
            options.securityPolicies = options.securityPolicies.map(coerceSecurityPolicy);
        }
        /**
         * @property maxConnectionsPerEndpoint
         */
        this.maxConnectionsPerEndpoint = options.maxConnectionsPerEndpoint || default_maxConnectionsPerEndpoint;
        this.sendCertificateChainInCreateSession = !!options.sendCertificateChainInCreateSession;
        // build Info
        const buildInfo = {
            ...default_build_info,
            ...options.buildInfo
        };
        // repair product name
        buildInfo.productUri = buildInfo.productUri || this.serverInfo.productUri;
        this.serverInfo.productUri = this.serverInfo.productUri || buildInfo.productUri;
        this.userManager = makeUserManager(options.userManager);
        this.unresolvedPermissionPolicy = options.unresolvedPermissionPolicy ?? "allow";
        options.allowAnonymous = options.allowAnonymous === undefined ? true : !!options.allowAnonymous;
        /**
         * @property allowAnonymous
         */
        this.allowAnonymous = options.allowAnonymous;
        // fail fast: a userTokenTypes list that leaves no usable token policy would
        // only be detected in initialize(), when the endpoints are created
        if (!options.endpoints) {
            resolveUserTokenTypes(options.userTokenTypes, options.allowAnonymous, { silent: true });
        }
        for (const endpointOptions of [...(options.endpoints || []), ...(options.alternateEndpoints || [])]) {
            const endpointAllowAnonymous = endpointOptions.allowAnonymous === undefined ? true : !!endpointOptions.allowAnonymous;
            resolveUserTokenTypes(endpointOptions.userTokenTypes, endpointAllowAnonymous, { silent: true });
        }
        this.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl || "opc.tcp://%FQDN%:4840";
        assert(typeof this.discoveryServerEndpointUrl === "string");
        this.serverInfo.applicationType =
            options.serverInfo?.applicationType === undefined ? ApplicationType.Server : options.serverInfo.applicationType;
        this.capabilitiesForMDNS = options.capabilitiesForMDNS || ["NA"];
        this.registerServerMethod = options.registerServerMethod || RegisterServerMethod.HIDDEN;
        _installRegisterServerManager(this);
        if (!options.userCertificateManager) {
            this.userCertificateManager = getDefaultCertificateManager("UserPKI");
        }
        else {
            this.userCertificateManager = options.userCertificateManager;
        }
        // note: we need to delay initialization of endpoint as certain resources
        // such as %FQDN% might not be ready yet at this stage
        this._delayInit = async () => {
            /* c8 ignore next */
            if (!options) {
                throw new Error("Internal Error");
            }
            // to check => this.serverInfo.applicationName = this.serverInfo.productName || buildInfo.productName;
            // note: applicationUri is handled in a special way
            this.engine = this.createEngine({
                applicationUri: () => this.serverInfo.applicationUri || "",
                buildInfo,
                isAuditing: options.isAuditing,
                allowAnonymousSubscriptionTransferOnUnsecuredChannel: options.allowAnonymousSubscriptionTransferOnUnsecuredChannel,
                diagnosticsNamespaceUri: options.diagnosticsNamespaceUri,
                serverCapabilities: options.serverCapabilities,
                serverConfiguration: {
                    serverCapabilities: () => {
                        return this.capabilitiesForMDNS || ["NA"];
                    },
                    supportedPrivateKeyFormat: ["PEM"],
                    applicationType: () => this.serverInfo.applicationType,
                    applicationUri: () => this.serverInfo.applicationUri || "",
                    productUri: () => this.serverInfo.productUri || "",
                    // hasSecureElement: () => false,
                    multicastDnsEnabled: () => this.registerServerMethod === RegisterServerMethod.MDNS
                }
            });
            this.objectFactory = new Factory(this.engine);
            const endpointDefinitions = [
                ...(options.endpoints || []),
                ...(options.alternateEndpoints || [])
            ];
            const hostname = getFullyQualifiedDomainName();
            endpointDefinitions.forEach((endpointDefinition) => {
                endpointDefinition.port = endpointDefinition.port === undefined ? 26543 : endpointDefinition.port;
                endpointDefinition.hostname = endpointDefinition.hostname || hostname;
            });
            if (!options.endpoints) {
                endpointDefinitions.push({
                    port: options.port === undefined ? 26543 : options.port,
                    hostname: options.hostname || hostname,
                    host: options.host,
                    allowAnonymous: options.allowAnonymous,
                    userTokenTypes: options.userTokenTypes,
                    allowUnsecurePassword: options.allowUnsecurePassword,
                    alternateHostname: options.alternateHostname,
                    advertisedEndpoints: options.advertisedEndpoints,
                    disableDiscovery: options.disableDiscovery,
                    securityModes: options.securityModes,
                    securityPolicies: options.securityPolicies
                });
            }
            // todo  should self.serverInfo.productUri  match self.engine.buildInfo.productUri ?
            for (const endpointOptions of endpointDefinitions) {
                const endPoint = this.createEndpointDescriptions(options, endpointOptions);
                this.endpoints.push(endPoint);
                endPoint.on("message", (message, channel) => {
                    this.on_request(message, channel);
                });
                endPoint.leanRequestHandler = this.leanRequestHandler();
                // endPoint.on("error", (err: Error) => {
                //     errorLog("OPCUAServer endpoint error", err);
                //     // set serverState to ServerState.Failed;
                //     this.engine.setServerState(ServerState.Failed);
                //     this.shutdown(() => {
                //         /* empty */
                //     });
                // });
            }
        };
    }
    initialize(...args) {
        const done = args[0];
        assert(!this.initialized, "server is already initialized"); // already initialized ?
        this._preInitTask.push(async () => {
            /* c8 ignore next */
            if (this._delayInit) {
                await this._delayInit();
                this._delayInit = undefined;
            }
        });
        this.performPreInitialization()
            .then(() => {
            OPCUAServer.registry.register(this);
            this.engine.initialize(this.options, (err) => {
                if (err) {
                    done(err);
                    return;
                }
                const failure = this.afterEngineInitialized();
                if (failure) {
                    done(failure);
                    return;
                }
                setImmediate(() => {
                    this.emit("post_initialize");
                    done();
                });
            });
        })
            .catch((err) => {
            done(err);
        });
    }
    /** gives a monitored item its sampling function, as the items of the subscriptions the server creates get it */
    prepareSamplingOf(context, monitoredItem) {
        prepareMonitoredItem(context, this.engine.nodeFinder, monitoredItem);
    }
    /** false once the engine is gone (shutdown): its address space, where monitored items find their nodes */
    engineServesSubscriptions() {
        return !!this.engine.addressSpace;
    }
    /** what the server installs in the address space of its engine once loaded; an error if it cannot */
    afterEngineInitialized() {
        if (!this.engine.addressSpace) {
            return new Error("no addressSpace");
        }
        bindRoleSet(this.userManager, this.engine.addressSpace);
        ensurePublishSubscribeIsBrowsable(this.engine.addressSpace);
        return null;
    }
    start(...args) {
        const callback = args[0];
        if (callback) {
            return super.start(callback);
        }
        return super.start();
    }
    /**
     * Initiate the server by starting all its endpoints
     * @private
     */
    async startAsync() {
        await extractFullyQualifiedDomainName();
        if (!this.initialized) {
            await this.initialize();
        }
        // a fresh start attempt invalidates whatever shutdown() concluded last time
        // (including a no-op from a previous failed start), so shutdown() runs for
        // real again if this attempt also needs to tear things down.
        this.#shutdownPromise = undefined;
        await this.#preExtractDataTypes();
        try {
            await super.startAsync();
        }
        catch (err) {
            await this.shutdown();
            throw err;
        }
        // we start the registration process asynchronously
        // as we want to make server immediately available
        this.registerServerManager?.start().catch(() => {
            /* empty */
        });
        // start dialing out to any configured reverse-connect clients (OPC UA Part 6 §7.1.3)
        if (this.options.reverseConnect?.connections?.length) {
            this.#reverseConnectManager = new ReverseConnectManager({
                getDialEndpoint: () => this.endpoints[0],
                getServerUri: () => this.serverInfo.applicationUri || "",
                getEndpointUrl: () => this.getEndpointUrl()
            }, this.options.reverseConnect);
            this.#reverseConnectManager.start();
        }
    }
    /**
     * Extract the address space data types now, while no client is connected.
     *
     * The Call and Write services need an ExtraDataTypeManager and build it lazily, the first
     * time one of them is served (`AddressSpaceAccessor#call` / `#write`). That walk goes
     * through a PseudoSession, whose browse defers every batch by one `setImmediate`, so it
     * costs a few hundred event loop turns - about 100 ms on an idle server, and nothing at
     * all once it has run. On a server that is already sampling thousands of monitored items
     * a single turn costs tens of milliseconds, and the same walk takes 20 to 60 s: the first
     * Call a client makes times out, every later one answers in milliseconds. That is how CTT
     * "Base Info ResendData Method 001" failed - not in ResendData, which needs ~100 ms, but
     * in the extraction its Call was the first to pay for.
     *
     * Paying it here costs the same work at a moment when nothing competes for the loop.
     * A failure is not fatal: the lazy path is still there and will report it per request.
     */
    async #preExtractDataTypes() {
        if (!this.engine.addressSpace) {
            return;
        }
        try {
            await ensureDatatypeExtracted(this.engine.addressSpace);
        }
        catch (err) {
            warningLog("OPCUAServer: data type extraction failed at startup: ", err.message);
        }
    }
    shutdown(...args) {
        const timeout = args.length === 1 ? OPCUAServer.defaultShutdownTimeout : args[0];
        const callback = (args.length === 1 ? args[0] : args[1]);
        assert(typeof callback === "function");
        // c8 ignore next
        doDebug && debugLog("OPCUAServer#shutdown (timeout = ", timeout, ")");
        // A shutdown already requested for this start cycle - in progress, or done -
        // is not restarted: every caller (including one racing in mid-teardown) shares
        // that same outcome instead of tearing the server down a second time.
        if (this.#shutdownPromise) {
            this.#shutdownPromise.then(() => callback()).catch((err) => callback(err));
            return;
        }
        /* c8 ignore next */
        if (!this.engine?.isStarted()) {
            // server was never started, already shut down, or cleaned itself up after
            // a failed start: shutting down a server that isn't running already gets
            // us to the state the caller wants, so this is a no-op, not an error.
            return callback();
        }
        this.#shutdownPromise = new Promise((resolve, reject) => {
            // stop dialing reverse-connect clients before endpoints are torn down, so no new
            // channel is created mid-shutdown and pending outbound sockets are destroyed.
            this.#reverseConnectManager?.stop();
            this.#reverseConnectManager = undefined;
            this.userCertificateManager.dispose();
            this.engine.setServerState(ServerState.Shutdown);
            const shutdownTime = new Date(Date.now() + timeout);
            this.engine.setShutdownTime(shutdownTime);
            // c8 ignore next
            doDebug && debugLog("OPCUAServer is now un-registering itself from  the discovery server ", this.buildInfo);
            if (!this.registerServerManager) {
                reject(new Error("invalid register server manager"));
                return;
            }
            this.registerServerManager
                .stop()
                .then(() => {
                // c8 ignore next
                doDebug && debugLog("OPCUAServer unregistered from discovery server successfully");
            })
                .catch((err) => {
                // c8 ignore next
                doDebug && debugLog("OPCUAServer unregistered from discovery server with err: ", err.message);
            })
                .finally(() => {
                setTimeout(async () => {
                    await this.engine.shutdown();
                    // c8 ignore next
                    doDebug && debugLog("OPCUAServer#shutdown: started");
                    OPCUABaseServer.prototype.shutdown.call(this, (err1) => {
                        // c8 ignore next
                        doDebug && debugLog("OPCUAServer#shutdown: completed");
                        this.dispose();
                        if (err1) {
                            reject(err1);
                        }
                        else {
                            resolve();
                        }
                    });
                }, timeout);
            });
        });
        this.#shutdownPromise.then(() => callback()).catch((err) => callback(err));
    }
    dispose() {
        for (const endpoint of this.endpoints) {
            endpoint.dispose();
        }
        this.endpoints = [];
        this.removeAllListeners();
        if (this.registerServerManager) {
            this.registerServerManager.dispose();
            this.registerServerManager = undefined;
        }
        OPCUAServer.registry.unregister(this);
        /* c8 ignore next */
        if (this.engine) {
            this.engine.dispose();
        }
    }
    raiseEvent(eventType, options) {
        /* c8 ignore next */
        if (!this.engine.addressSpace) {
            errorLog("addressSpace missing");
            return;
        }
        const server = this.engine.addressSpace.findNode("Server");
        /* c8 ignore next */
        if (!server) {
            // xx throw new Error("OPCUAServer#raiseEvent : cannot find Server object");
            return;
        }
        let eventTypeNode = eventType;
        if (typeof eventType === "string") {
            eventTypeNode = this.engine.addressSpace.findEventType(eventType);
            if (eventTypeNode) {
                server.raiseEvent(eventTypeNode, options);
            }
            else {
                console.warn(" cannot find event type ", eventType);
            }
        }
        else {
            server.raiseEvent(eventTypeNode, options);
        }
    }
    /**
     * create and register a new session
     * @private
     */
    createSession(options) {
        /* c8 ignore next */
        if (!this.engine) {
            throw new Error("Internal Error");
        }
        return this.engine.createSession(options);
    }
    /**
     * retrieve a session by authentication token
     * @private
     */
    getSession(authenticationToken, activeOnly) {
        return this.engine ? this.engine.getSession(authenticationToken, activeOnly) : null;
    }
    /**
     *
     * @param channel
     * @param clientCertificate
     * @param clientNonce
     * @private
     */
    computeServerSignature(channel, clientCertificate, clientNonce) {
        return computeSignature(clientCertificate, clientNonce, this.getPrivateKey(), channel.securityPolicy);
    }
    /**
     * {@link computeServerSignature} through the opaque key-operations path,
     * so the server's application instance key may be HSM/KMS-held. Default
     * implementation delegates to a subclass's `computeServerSignature`
     * override when one exists (so existing subclasses keep their behavior),
     * and signs through the channel-pinned key operations otherwise.
     * @private
     */
    async computeServerSignatureAsync(channel, clientCertificate, clientNonce) {
        const isOverridden = Object.getPrototypeOf(this).computeServerSignature !== OPCUAServerCore.prototype.computeServerSignature;
        if (isOverridden) {
            return this.computeServerSignature(channel, clientCertificate, clientNonce);
        }
        return await computeSignatureAsync(clientCertificate, clientNonce, channel.getKeyOperations(), channel.securityPolicy);
    }
    /**
     *
     * @param session
     * @param channel
     * @param clientSignature
     */
    verifyClientSignature(session, channel, clientSignature) {
        const clientCertificate = channel.clientCertificate;
        const securityPolicy = channel.securityPolicy;
        const result = verifySignature(this.#signedServerCertificate(), session.nonce, clientSignature, clientCertificate, securityPolicy);
        return result;
    }
    /**
     * The server certificate a client or user token signs with the server nonce,
     * as the whole chain the endpoints advertise: verifySignature() tries the
     * leaf first, then this chain (OPC 10000-4 §6.1.8).
     */
    #signedServerCertificate() {
        return combine_der(this.getCertificateChain());
    }
    isValidUserNameIdentityToken(channel, _session, userTokenPolicy, userIdentityToken, _userTokenSignature, callback) {
        assert(userIdentityToken instanceof UserNameIdentityToken);
        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);
        if (securityPolicy === SecurityPolicy.None) {
            callback(null, StatusCodes.Good);
            return;
        }
        const cryptoFactory = getCryptoFactory(securityPolicy);
        /* c8 ignore next */
        if (!cryptoFactory) {
            callback(null, StatusCodes.BadSecurityPolicyRejected);
            return;
        }
        /* c8 ignore next */
        if (userIdentityToken.encryptionAlgorithm !== cryptoFactory.asymmetricEncryptionAlgorithm) {
            errorLog("invalid encryptionAlgorithm");
            errorLog("userTokenPolicy", userTokenPolicy.toString());
            errorLog("userTokenPolicy", userIdentityToken.toString());
            callback(null, StatusCodes.BadIdentityTokenInvalid);
            return;
        }
        const userName = userIdentityToken.userName;
        const password = userIdentityToken.password;
        if (!userName || !password) {
            callback(null, StatusCodes.BadIdentityTokenInvalid);
            return;
        }
        callback(null, StatusCodes.Good);
    }
    isValidX509IdentityToken(channel, session, userTokenPolicy, userIdentityToken, userTokenSignature, callback) {
        assert(userIdentityToken instanceof X509IdentityToken);
        assert(typeof callback === "function");
        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);
        const cryptoFactory = getCryptoFactory(securityPolicy);
        /* c8 ignore next */
        if (!cryptoFactory) {
            callback(null, StatusCodes.BadSecurityPolicyRejected);
            return;
        }
        // no audit event here: this validates the token of an ActivateSession call, and the caller
        // (_on_ActivateSessionRequest) raises the AuditActivateSessionEventType for any rejection,
        // with the request's AuditEntryId this method has no access to (OPC 10000-4 v1.05.07 §6.5.6).
        if (!userTokenSignature?.signature) {
            callback(null, StatusCodes.BadUserSignatureInvalid);
            return;
        }
        if (userIdentityToken.policyId !== userTokenPolicy.policyId) {
            errorLog("invalid encryptionAlgorithm");
            errorLog("userTokenPolicy", userTokenPolicy.toString());
            errorLog("userTokenPolicy", userIdentityToken.toString());
            callback(null, StatusCodes.BadSecurityPolicyRejected);
            return;
        }
        const certificate = userIdentityToken.certificateData; /* as Certificate*/
        const nonce = session.nonce;
        if (!nonce || nonce.length === 0) {
            callback(null, StatusCodes.BadNonceInvalid);
            return;
        }
        assert(userTokenSignature.signature instanceof Buffer, "expecting userTokenSignature to be a Buffer");
        // verify proof of possession by checking certificate signature & server nonce correctness
        if (!verifySignature(this.#signedServerCertificate(), nonce, userTokenSignature, certificate, securityPolicy)) {
            callback(null, StatusCodes.BadUserSignatureInvalid);
            return;
        }
        // verify if certificate is Valid
        this.userCertificateManager.checkCertificate(certificate, (err, certificateStatus) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }
            if (this.isAuditing) {
                switch (certificateStatus) {
                    case StatusCodes.Good:
                        break;
                    case StatusCodes.BadCertificateUntrusted:
                        this.raiseEvent("AuditCertificateUntrustedEventType", {
                            severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
                            certificate: {
                                dataType: DataType.ByteString,
                                value: certificate
                            },
                            sourceName: {
                                dataType: DataType.String,
                                value: "Security/Certificate"
                            }
                        });
                        break;
                    case StatusCodes.BadCertificateTimeInvalid:
                    case StatusCodes.BadCertificateIssuerTimeInvalid:
                        this.raiseEvent("AuditCertificateExpiredEventType", {
                            severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
                            certificate: {
                                dataType: DataType.ByteString,
                                value: certificate
                            },
                            sourceName: {
                                dataType: DataType.String,
                                value: "Security/Certificate"
                            }
                        });
                        break;
                    case StatusCodes.BadCertificateRevoked:
                    case StatusCodes.BadCertificateRevocationUnknown:
                    case StatusCodes.BadCertificateIssuerRevocationUnknown:
                        this.raiseEvent("AuditCertificateRevokedEventType", {
                            severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
                            certificate: {
                                dataType: DataType.ByteString,
                                value: certificate
                            },
                            sourceName: {
                                dataType: DataType.String,
                                value: "Security/Certificate"
                            }
                        });
                        break;
                    case StatusCodes.BadCertificateIssuerUseNotAllowed:
                    case StatusCodes.BadCertificateUseNotAllowed:
                    case StatusCodes.BadSecurityChecksFailed:
                        this.raiseEvent("AuditCertificateMismatchEventType", {
                            severity: { dataType: "UInt16", value: AUDIT_SEVERITY_SECURITY_FAILURE },
                            certificate: {
                                dataType: DataType.ByteString,
                                value: certificate
                            },
                            sourceName: {
                                dataType: DataType.String,
                                value: "Security/Certificate"
                            }
                        });
                        break;
                }
            }
            if (certificateStatus &&
                (StatusCodes.BadCertificateUntrusted.equals(certificateStatus) ||
                    StatusCodes.BadCertificateTimeInvalid.equals(certificateStatus) ||
                    StatusCodes.BadCertificateIssuerTimeInvalid.equals(certificateStatus) ||
                    StatusCodes.BadCertificateIssuerUseNotAllowed.equals(certificateStatus) ||
                    StatusCodes.BadCertificateIssuerRevocationUnknown.equals(certificateStatus) ||
                    StatusCodes.BadCertificateRevocationUnknown.equals(certificateStatus) ||
                    StatusCodes.BadCertificateRevoked.equals(certificateStatus) ||
                    StatusCodes.BadCertificateUseNotAllowed.equals(certificateStatus) ||
                    StatusCodes.BadSecurityChecksFailed.equals(certificateStatus) ||
                    !StatusCodes.Good.equals(certificateStatus))) {
                // c8 ignore next
                doDebug && debugLog("isValidX509IdentityToken => certificateStatus = ", certificateStatus?.toString());
                return callback(null, StatusCodes.BadIdentityTokenRejected);
            }
            if (StatusCodes.Good !== certificateStatus) {
                assert(certificateStatus instanceof StatusCode);
                return callback(null, certificateStatus);
                // return callback(null, StatusCodes.BadIdentityTokenInvalid);
            }
            // verify if certificate is truster or rejected
            // todo: StatusCodes.BadCertificateUntrusted
            // store untrusted certificate to rejected folder
            // todo:
            return callback(null, StatusCodes.Good);
        });
    }
    /**
     * @internal
     */
    userNameIdentityTokenAuthenticateUser(channel, session, userTokenPolicy, userIdentityToken, callback) {
        assert(userIdentityToken instanceof UserNameIdentityToken);
        // assert(this.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken));
        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);
        const userName = userIdentityToken.userName;
        if (!userName) {
            callback(new Error(" expecting a no null username"));
            return;
        }
        const initialPassword = userIdentityToken.password;
        const validateUser = (password) => {
            this.userManager
                .isValidUser(session, userName, password)
                .then((isValid) => callback(null, isValid))
                .catch((err) => callback(err));
        };
        // decrypt password if necessary
        if (securityPolicy === SecurityPolicy.None) {
            // not good, password was sent in clear text ...
            validateUser(initialPassword.toString());
            return;
        }
        const serverNonce = session.nonce;
        if (!serverNonce) {
            callback(new Error(" expecting a no null nonce"));
            return;
        }
        const cryptoFactory = getCryptoFactory(securityPolicy);
        /* c8 ignore next */
        if (!cryptoFactory) {
            callback(new Error(" Unsupported security Policy"));
            return;
        }
        // decrypt through the CHANNEL-PINNED key operations: the password was
        // encrypted against the certificate this session's channel presented,
        // so a server-level key rotation must not change the key used here —
        // and the key itself may be HSM/KMS-held.
        asymmetricDecryptWithKeyOps(cryptoFactory, initialPassword, channel.getKeyOperations()).then((buff) => {
            const result = extractPasswordFromDecryptedBlob(buff, serverNonce);
            if (!result.valid) {
                // OPC UA Part 4 - Token Encryption and Proof of Possession:
                // the serverNonce must be appended to the password before
                // encryption. A blob that does not carry it is a malformed
                // token, not a wrong credential.
                return callback(null, false, StatusCodes.BadIdentityTokenInvalid);
            }
            validateUser(result.password);
        }, () => {
            // an undecryptable password blob is a malformed identity token,
            // not a server error
            callback(null, false, StatusCodes.BadIdentityTokenInvalid);
        });
    }
    /**
     * @internal
     */
    isValidUserIdentityToken(channel, session, userIdentityToken, userTokenSignature, endpointDescription, callback) {
        assert(typeof callback === "function");
        /* c8 ignore next */
        if (!userIdentityToken) {
            throw new Error("Invalid token");
        }
        const userTokenType = getTokenType(userIdentityToken);
        const userTokenPolicy = findUserTokenByPolicy(endpointDescription, userTokenType, userIdentityToken.policyId);
        if (!userTokenPolicy) {
            // cannot find token with this policyId
            callback(null, StatusCodes.BadIdentityTokenInvalid);
            return;
        }
        //
        if (userIdentityToken instanceof UserNameIdentityToken) {
            this.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken, userTokenSignature, callback);
            return;
        }
        if (userIdentityToken instanceof X509IdentityToken) {
            this.isValidX509IdentityToken(channel, session, userTokenPolicy, userIdentityToken, userTokenSignature, callback);
            return;
        }
        callback(null, StatusCodes.Good);
    }
    /**
     *
     * @internal
     * @param channel
     * @param session
     * @param userIdentityToken
     * @param callback
     * @returns {*}
     */
    isUserAuthorized(channel, session, userIdentityToken, callback) {
        assert(userIdentityToken);
        assert(typeof callback === "function");
        const userTokenType = getTokenType(userIdentityToken);
        const userTokenPolicy = findUserTokenByPolicy(session.getEndpointDescription(), userTokenType, userIdentityToken.policyId);
        /** c8 ignore next */
        if (!userTokenPolicy) {
            callback(null, false);
            return;
        }
        // find if a userToken exists
        if (userIdentityToken instanceof UserNameIdentityToken) {
            this.userNameIdentityTokenAuthenticateUser(channel, session, userTokenPolicy, userIdentityToken, callback);
            return;
        }
        setImmediate(callback.bind(null, null, true));
    }
    makeServerNonce() {
        return randomBytes(32);
    }
    // session services
    async _on_CreateSessionRequest(message, channel) {
        const request = message.request;
        assert(request instanceof CreateSessionRequest);
        // OPC 10000-4 v1.05.07 §6.5.6: the Session Service Set "shall generate audit Events for both successful
        // and failed Service invocations [...] The CreateSession service shall generate
        // AuditCreateSessionEventType events". Every refusal below goes through here, so each failed
        // request raises exactly one, with Status false.
        function rejectConnection(server, statusCode) {
            raiseAuditCreateSessionFailure(server, request, channel, statusCode);
            server.engine.incrementSecurityRejectedSessionCount();
            const response1 = new ServiceFault({
                responseHeader: { serviceResult: statusCode }
            });
            channel.send_response("MSG", response1, message);
            // and close !
        }
        // Release 1.03 OPC Unified Architecture, Part 4 page 24 - CreateSession Parameters
        // client should prove a sessionName
        // Session name is a Human readable string that identifies the Session. The Server makes this name and the
        // sessionId visible in its AddressSpace for diagnostic purposes. The Client should provide a name that is
        // unique for the instance of the Client.
        // If this parameter is not specified the Server shall assign a value.
        if (isNullOrUndefined(request.sessionName)) {
            // see also #198
            // let's the server assign a sessionName for this lazy client.
            // c8 ignore next
            doDebug &&
                debugLog("assigning OPCUAServer.fallbackSessionName because client's sessionName is null ", OPCUAServer.fallbackSessionName);
            request.sessionName = OPCUAServer.fallbackSessionName;
        }
        // Duration Requested maximum number of milliseconds that a Session should remain open without activity.
        // If the Client fails to issue a Service request within this interval, then the Server shall automatically
        // terminate the Client Session.
        const revisedSessionTimeout = _adjust_session_timeout(request.requestedSessionTimeout);
        // Release 1.02 page 27 OPC Unified Architecture, Part 4: CreateSession.clientNonce
        // A random number that should never be used in any other request. This number shall have a minimum length of 32
        // bytes. Profiles may increase the required length. The Server shall use this value to prove possession of
        // its application instance Certificate in the response.
        if (!request.clientNonce || request.clientNonce.length < 32) {
            if (channel.securityMode !== MessageSecurityMode.None) {
                errorLog(chalk.red("SERVER with secure connection: Missing or invalid client Nonce "), request.clientNonce?.toString("hex"));
                return rejectConnection(this, StatusCodes.BadNonceInvalid);
            }
        }
        // Reject an over-long client nonce before it reaches the replay cache. This applies in
        // every security mode, including None: a nonce is only key material, so a legitimate value
        // never exceeds MAX_NONCE_LENGTH, and the check keeps the CreateSession path from retaining
        // an arbitrarily large value.
        if (request.clientNonce && request.clientNonce.length > MAX_NONCE_LENGTH) {
            errorLog(chalk.red("SERVER: client Nonce is too large "), request.clientNonce.length, " > ", MAX_NONCE_LENGTH);
            return rejectConnection(this, StatusCodes.BadNonceInvalid);
        }
        if (nonceAlreadyBeenUsed(request.clientNonce)) {
            errorLog(chalk.red("SERVER with secure connection: Nonce has already been used"), request.clientNonce?.toString("hex"));
            return rejectConnection(this, StatusCodes.BadNonceInvalid);
        }
        // check application spoofing
        // check if applicationUri in createSessionRequest matches applicationUri in client Certificate
        if (!validate_applicationUri(channel, request)) {
            return rejectConnection(this, StatusCodes.BadCertificateUriInvalid);
        }
        this._warnIfEndpointHostNotInCertificate(request.endpointUrl);
        const { errCode, endpoint } = validate_security_endpoint(this, request, channel);
        if (errCode !== StatusCodes.Good) {
            return rejectConnection(this, errCode);
        }
        // From OPCUA V1.03 Part 4 5.6.2 CreateSession
        // A Server application should limit the number of Sessions. To protect against misbehaving Clients and denial
        // of service attacks, the Server shall close the oldest Session that is not activated before reaching the
        // maximum number of supported Sessions. Asked once the request is valid: a refused request takes no
        // room, and closes no other Session to make some.
        if (!(await this.engine.admitSession())) {
            return rejectConnection(this, StatusCodes.BadTooManySessions);
        }
        // A CreateSession can still arrive after shutdown() has begun disposing the
        // engine. Refuse it here, through the same path as every other refusal, so the
        // client gets a ServiceFault: throwing from the engine instead unwinds into a
        // promise nobody awaits, and an unhandled rejection takes the process down
        // rather than failing one request.
        if (this.engine._internalState === "shutdown" || this.engine._internalState === "disposed") {
            return rejectConnection(this, StatusCodes.BadServerHalted);
        }
        // see Release 1.02  27  OPC Unified Architecture, Part 4
        const session = this.createSession({
            clientDescription: request.clientDescription,
            sessionTimeout: revisedSessionTimeout,
            server: this
        });
        session.endpoint = endpoint;
        assert(session);
        assert(session.sessionTimeout === revisedSessionTimeout);
        session.clientDescription = request.clientDescription;
        session.sessionName = request.sessionName || `<unknown session name ${unnamed_session_count++}>`;
        // Depending upon on the  SecurityPolicy  and the  SecurityMode  of the  SecureChannel,  the exchange of
        // ApplicationInstanceCertificates   and  Nonces  may be optional and the signatures may be empty. See
        // Part  7  for the definition of  SecurityPolicies  and the handling of these parameters
        // serverNonce:
        // A random number that should never be used in any other request.
        // This number shall have a minimum length of 32 bytes.
        // The Client shall use this value to prove possession of its application instance
        // Certificate in the ActivateSession request.
        // This value may also be used to prove possession of the userIdentityToken it
        // specified in the ActivateSession request.
        //
        // ( this serverNonce will only be used up to the _on_ActivateSessionRequest
        //   where a new nonce will be created)
        session.nonce = this.makeServerNonce();
        session.channelId = channel.channelId;
        session._attach_channel(channel);
        const certificateChain = this.getCertificateChain();
        const serverCertificateChain = this.sendCertificateChainInCreateSession ? certificateChain : certificateChain.slice(0, 1);
        const hasEncryption = true;
        // If the securityPolicyUri is None and none of the UserTokenPolicies requires encryption
        if (session.channel?.securityMode === MessageSecurityMode.None) {
            // ToDo: Check that none of our insecure endpoint has a a UserTokenPolicy that require encryption
            // and set hasEncryption = false under this condition
        }
        // asynchronous (the server's key may be HSM/KMS-held), so it is
        // computed before the response object is assembled
        const serverSignature = await this.computeServerSignatureAsync(channel, request.clientCertificate, request.clientNonce);
        const response = new CreateSessionResponse({
            // A identifier which uniquely identifies the session.
            sessionId: session.nodeId,
            // A unique identifier assigned by the Server to the Session.
            // The token used to authenticate the client in subsequent requests.
            authenticationToken: session.authenticationToken,
            revisedSessionTimeout,
            serverNonce: session.nonce,
            // serverCertificate: type ApplicationServerCertificate
            // The application instance Certificate issued to the Server.
            // A Server shall prove possession by using the private key to sign the Nonce provided
            // by the Client in the request. The Client shall verify that this Certificate is the same as
            // the one it used to create the SecureChannel.
            // The ApplicationInstanceCertificate type is defined in OpCUA 1.03 part 4 - $7.2 page 108
            // If the securityPolicyUri is None and none of the UserTokenPolicies requires
            // encryption, the Server shall not send an ApplicationInstanceCertificate and the Client
            // shall ignore the ApplicationInstanceCertificate.
            serverCertificate: hasEncryption && serverCertificateChain.length > 0 ? combine_der(serverCertificateChain) : undefined,
            // The endpoints provided by the server.
            // The Server shall return a set of EndpointDescriptions available for the serverUri
            // specified in the request.[...]
            // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery
            // Endpoint to fetch the EndpointDescriptions.
            // It is recommended that Servers only include the endpointUrl, securityMode,
            // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
            // other parameters set to null. Only the recommended parameters shall be verified by
            // the client.
            serverEndpoints: _serverEndpointsForCreateSessionResponse(this, session.endpoint?.endpointUrl || "", request.serverUri),
            // This parameter is deprecated and the array shall be empty.
            serverSoftwareCertificates: null,
            // This is a signature generated with the private key associated with the
            // serverCertificate. This parameter is calculated by appending the clientNonce to the
            // clientCertificate and signing the resulting sequence of bytes.
            // The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm specified in the
            // SecurityPolicy for the Endpoint.
            // The SignatureData type is defined in 7.30.
            serverSignature,
            // The maximum message size accepted by the server
            // The Client Communication Stack should return a Bad_RequestTooLarge error to the
            // application if a request message exceeds this limit.
            // The value zero indicates that this parameter is not used.
            maxRequestMessageSize: 0x4000000
        });
        this.emit("create_session", session);
        session.on("session_closed", (session1, deleteSubscriptions, reason, auditEntryId) => {
            assert(typeof reason === "string");
            if (this.isAuditing) {
                assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");
                // OPC 10000-4 v1.05.07 §6.5.6: "The SourceName for Events of this type shall be
                // 'Session/Timeout' for a Session timeout, 'Session/CloseSession' for a CloseSession
                // Service call and 'Session/Terminated' for all other cases." "Forcing" (the oldest
                // unactivated Session closed to make room) is one of the other cases.
                const sourceName = reason === "Timeout" || reason === "CloseSession" ? `Session/${reason}` : "Session/Terminated";
                this.raiseEvent("AuditSessionEventType", {
                    /* part 5 -  6.4.3 AuditEventType */
                    actionTimeStamp: { dataType: "DateTime", value: new Date() },
                    status: { dataType: "Boolean", value: true },
                    severity: { dataType: "UInt16", value: AUDIT_SEVERITY_INFO },
                    serverId: { dataType: "String", value: this.serverInfo.applicationUri || "" },
                    // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                    // Only present when this close was caused by a client CloseSession request
                    // (reason === "CloseSession"); Timeout/Terminated/Forcing have no request to take it from.
                    clientAuditEntryId: { dataType: "String", value: auditEntryId ?? "" },
                    // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
                    // obtained from the UserIdentityToken passed in the ActivateSession call (OPC 10000-5 v1.05.06 §6.4.3).
                    clientUserId: { dataType: "String", value: getClientUserIdForAudit(session1.userIdentityToken) },
                    sourceName: { dataType: "String", value: sourceName },
                    /* part 5 - 6.4.7 AuditSessionEventType */
                    sessionId: { dataType: "NodeId", value: session1.nodeId }
                });
            }
            this.emit("session_closed", session1, deleteSubscriptions);
        });
        if (this.isAuditing) {
            // ------------------------------------------------------------------------------------------------------
            this.raiseEvent("AuditCreateSessionEventType", {
                /* part 5 -  6.4.3 AuditEventType */
                actionTimeStamp: { dataType: "DateTime", value: new Date() },
                status: { dataType: "Boolean", value: true },
                severity: { dataType: "UInt16", value: AUDIT_SEVERITY_INFO },
                serverId: { dataType: "String", value: this.serverInfo.applicationUri || "" },
                // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                clientAuditEntryId: { dataType: "String", value: request.requestHeader.auditEntryId ?? "" },
                // The ClientUserId identifies the user of the client requesting an action. No UserIdentityToken
                // has been supplied yet at CreateSession time, and OPC 10000-5 v1.05.06 §6.4.8 says this parameter "shall be
                // set to the 'System/CreateSession'" for that reason (see CLIENT_USER_ID_CREATE_SESSION).
                clientUserId: { dataType: "String", value: CLIENT_USER_ID_CREATE_SESSION },
                sourceName: { dataType: "String", value: "Session/CreateSession" },
                /* part 5 - 6.4.7 AuditSessionEventType */
                sessionId: { dataType: "NodeId", value: session.nodeId },
                /* part 5 - 6.4.8 AuditCreateSessionEventType */
                // SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same
                // identifier in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
                // AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
                // (AuditChannelEventType and its subtypes
                secureChannelId: {
                    dataType: "String",
                    value: session.channel?.channelId?.toString() ?? ""
                },
                // Duration
                revisedSessionTimeout: {
                    dataType: "Duration",
                    value: session.sessionTimeout
                },
                // clientCertificate: OPC 10000-5 v1.05.06 §6.4.8 "is the clientCertificate parameter of the
                // CreateSession Service call" - the request's own parameter, the same source the
                // refused-CreateSession path (raiseAuditCreateSessionFailure) already uses, not
                // session.channel.clientCertificate (the certificate that secures the channel
                // itself: a related but distinct value, populated asynchronously and only for a
                // channel whose message security mode is not None).
                clientCertificate: {
                    dataType: "ByteString",
                    value: getRequestClientCertificate(request)
                },
                // clientCertificateThumbprint
                clientCertificateThumbprint: {
                    dataType: "String",
                    value: thumbprint(getRequestClientCertificate(request))
                }
            });
        }
        // -----------------------------------------------------------------------------------------------------------
        assert(response.authenticationToken);
        channel.send_response("MSG", response, message);
    }
    // TODO : implement this:
    //
    // When the ActivateSession Service is called for the first time then the Server shall reject the request
    // if the SecureChannel is not same as the one associated with the CreateSession request.
    // Subsequent calls to ActivateSession may be associated with different SecureChannels. If this is the
    // case then the Server shall verify that the Certificate the Client used to create the new
    // SecureChannel is the same as the Certificate used to create the original SecureChannel. In addition,
    // the Server shall verify that the Client supplied a UserIdentityToken that is identical to the token
    // currently associated with the Session. Once the Server accepts the new SecureChannel it shall
    // reject requests sent via the old SecureChannel.
    /**
     *
     * @private
     *
     *
     */
    _on_ActivateSessionRequest(message, channel) {
        const request = message.request;
        assert(request instanceof ActivateSessionRequest);
        // get session from authenticationToken
        const authenticationToken = request.requestHeader.authenticationToken;
        const session = this.getSession(authenticationToken);
        // OPC 10000-4 v1.05.07 §6.5.6: the Session Service Set "shall generate audit Events for both successful
        // and failed Service invocations"; OPC 10000-5 v1.05.06 §6.4.10: ActivateSession raises an
        // AuditActivateSessionEventType. Every refusal below goes through here, so each failed
        // request raises exactly one, with Status false.
        function rejectConnection(server, statusCode) {
            const given = session ? server.activationRefused(session) : undefined;
            raiseAuditActivateSessionEventType.call(server, session, request.requestHeader.auditEntryId ?? "", {
                statusCode,
                userIdentityToken: request.userIdentityToken,
                channel
            });
            if (statusCode.equals(StatusCodes.BadSessionIdInvalid)) {
                server.engine.incrementRejectedSessionCount();
            }
            else {
                server.engine.incrementRejectedSessionCount();
                server.engine.incrementSecurityRejectedSessionCount();
            }
            const response1 = new ActivateSessionResponse({
                responseHeader: { serviceResult: statusCode }
            });
            // the refusal is heard once a session taken from another front is back there
            if (given)
                given.then(send, send);
            else
                send();
            function send() {
                channel.send_response("MSG", response1, message);
            }
        }
        /* c8 ignore next */
        if (!session) {
            // this may happen when the server has been restarted and a client tries to reconnect, thinking
            // that the previous session may still be active
            // c8 ignore next
            doDebug && debugLog(chalk.yellow.bold(" Bad Session in  _on_ActivateSessionRequest"), authenticationToken.toString());
            rejectConnection(this, StatusCodes.BadSessionIdInvalid);
            return;
        }
        session.keepAlive ? session.keepAlive() : void 0;
        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
        // if the  SecureChannel  is not same as the one associated with the  CreateSession  request.
        if (session.status === "new") {
            // xx if (channel.session_nonce !== session.nonce) {
            if (!channel_has_session(channel, session)) {
                // it looks like session activation is being using a channel that is not the
                // one that have been used to create the session
                errorLog(` channel.sessionTokens === ${Object.keys(channel.sessionTokens).join(" ")}`);
                rejectConnection(this, StatusCodes.BadSessionNotActivated);
                return;
            }
        }
        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // ... Subsequent calls to  ActivateSession  may be associated with different  SecureChannels.  If this is the
        // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
        // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.
        if (session.status === "active") {
            if (session.channel?.channelId !== channel.channelId) {
                warningLog(" Session ", session.sessionName, " is being transferred from channel", chalk.cyan(session.channel?.channelId?.toString()), " to channel ", chalk.cyan(channel.channelId?.toString()));
                // session is being reassigned to a new Channel,
                // we shall verify that the certificate used to create the Session is the same as the current
                // channel certificate.
                // the channel's own, or the one it had in the front thread it comes from
                const old_channel_cert_thumbprint = thumbprint(session.channelSecurity?.clientCertificate);
                const new_channel_cert_thumbprint = thumbprint(channel.clientCertificate);
                if (old_channel_cert_thumbprint !== new_channel_cert_thumbprint) {
                    rejectConnection(this, StatusCodes.BadNoValidCertificates); // not sure about this code !
                    return;
                }
                // ... In addition the Server shall verify that the  Client  supplied a  UserIdentityToken  that is
                // identical to the token currently associated with the  Session reassign session to new channel.
                if (!sameIdentityToken(session.userIdentityToken, request.userIdentityToken)) {
                    rejectConnection(this, StatusCodes.BadIdentityChangeNotSupported); // not sure about this code !
                    return;
                }
            }
        }
        else if (session.status === "screwed") {
            // session has been used before being activated => this should be detected and session should be dismissed.
            rejectConnection(this, StatusCodes.BadSessionClosed);
            return;
        }
        else if (session.status === "closed") {
            warningLog(chalk.yellow.bold(" Bad Session Closed in  _on_ActivateSessionRequest"), authenticationToken.toString());
            rejectConnection(this, StatusCodes.BadSessionClosed);
            return;
        }
        // verify clientSignature provided by the client
        if (!this.verifyClientSignature(session, channel, request.clientSignature)) {
            rejectConnection(this, StatusCodes.BadApplicationSignatureInvalid);
            return;
        }
        const endpoint = session.endpoint;
        if (!endpoint) {
            rejectConnection(this, StatusCodes.BadSessionIdInvalid);
            return;
        }
        // userIdentityToken may be missing , assume anonymous access then
        // (OPC 10000-4 5.7.3: a null userIdentityToken is an AnonymousIdentityToken).
        // When the endpoint does not advertise Anonymous, the token is not valid for it:
        // reject the request instead of letting createAnonymousIdentityToken throw
        // (which would end as a ServiceFault BadInternalError with no audit event).
        if (!request.userIdentityToken) {
            if (!findUserTokenPolicy(endpoint, UserTokenType.Anonymous)) {
                rejectConnection(this, StatusCodes.BadIdentityTokenInvalid);
                return;
            }
            request.userIdentityToken = createAnonymousIdentityToken(endpoint);
        }
        // check request.userIdentityToken is correct ( expected type and correctly formed)
        this.isValidUserIdentityToken(channel, session, request.userIdentityToken, request.userTokenSignature, endpoint, (_err, statusCode) => {
            if (!statusCode || statusCode.isNotGood()) {
                const rejectionStatusCode = statusCode && statusCode instanceof StatusCode ? statusCode : StatusCodes.BadCertificateInvalid;
                // e.g. an X509 user token whose signature is missing or invalid (Bad_UserSignatureInvalid)
                return rejectConnection(this, rejectionStatusCode);
            }
            // check if user access is granted
            this.isUserAuthorized(channel, session, request.userIdentityToken, (err1, authorized, statusCode) => {
                /* c8 ignore next */
                if (err1) {
                    return rejectConnection(this, StatusCodes.BadInternalError);
                }
                if (!authorized) {
                    return rejectConnection(this, statusCode || StatusCodes.BadUserAccessDenied);
                }
                else {
                    if (session.status !== "new" && session.status !== "active") {
                        // closed while its user was being checked: by the CreateSession of
                        // another client, which made room by closing the oldest Session not
                        // activated yet (OPC 10000-4 5.6.2). Activating it now would bring
                        // back a Session the server no longer counts.
                        return rejectConnection(this, StatusCodes.BadSessionClosed);
                    }
                    if (session.status === "active") {
                        moveSessionToChannel(session, channel);
                    }
                    session.userIdentityToken = request.userIdentityToken;
                    // OPC 10000-4 v1.05.07 §5.7.3 ActivateSession: a null/empty
                    // localeIds keeps the Session's current list, see setLocaleIds.
                    session.setLocaleIds(request.localeIds);
                    // extract : OPC UA part 4 - 5.6.3
                    // Once used, a serverNonce cannot be used again. For that reason, the Server returns a new
                    // serverNonce each time the ActivateSession Service is called.
                    session.nonce = this.makeServerNonce();
                    session.status = "active";
                    // OPC 10000-18 §5.2.8: a userManager may flag that the
                    // user must change the password; surface it to the Client.
                    const activationStatus = session.passwordChangeRequired
                        ? StatusCodes.GoodPasswordChangeRequired
                        : StatusCodes.Good;
                    const response = new ActivateSessionResponse({
                        responseHeader: { serviceResult: activationStatus },
                        serverNonce: session.nonce
                    });
                    const answer = () => {
                        channel.send_response("MSG", response, message);
                        // send OPCUA Event Notification
                        // see part 5 : 6.4.3 AuditEventType
                        //              6.4.7 AuditSessionEventType
                        //              6.4.10 AuditActivateSessionEventType
                        assert(session.nodeId); // sessionId
                        // xx assert(session.channel.clientCertificate instanceof Buffer);
                        assert(session.sessionTimeout > 0);
                        raiseAuditActivateSessionEventType.call(this, session, request.requestHeader.auditEntryId ?? "");
                        this.emit("session_activated", session, userIdentityTokenPasswordRemoved(session.userIdentityToken));
                        session.resendMonitoredItemInitialValues();
                    };
                    const recorded = this.recordActivation(session);
                    if (recorded) {
                        recorded.then(answer, answer);
                    }
                    else {
                        answer();
                    }
                }
            });
        });
    }
    /**
     * an ActivateSession about to be answered: a server that keeps its sessions in another thread
     * (FrontOPCUAServer) records the activation there first, so that once the client has its answer,
     * the session is active wherever the server is read from. Nothing to wait for here.
     */
    recordActivation(_session) {
        return undefined;
    }
    /**
     * @internal the requests this server answers from their bytes (see ServerSecureChannelParent.leanRequestHandler):
     * none here, FrontOPCUAServer answers the Reads it serves in place
     */
    leanRequestHandler() {
        const engine = this.engine;
        const host = {
            getSession: (token, activeOnly) => this.getSession(token, activeOnly),
            get maxNodesPerRead() {
                return engine.serverCapabilities.operationLimits.maxNodesPerRead ?? 0;
            },
            // a Variable read at once: not one whose value is refreshed asynchronously first (prepareRead)
            itemOf: (nodeId) => {
                const node = engine.addressSpace?.findNode(nodeId);
                if (!node || node.nodeClass !== NodeClass.Variable)
                    return null;
                const { refreshFunc, _refreshFuncWrapsGetter } = node;
                return typeof refreshFunc === "function" && !_refreshFuncWrapsGetter ? null : nodeId;
            },
            read: (context, items, maxAge, timestampsToReturn) => engine.readSync(context, {
                maxAge,
                timestampsToReturn,
                nodesToRead: items.map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value }))
            })
        };
        const writeHost = {
            getSession: host.getSession,
            get maxNodesPerWrite() {
                return engine.serverCapabilities.operationLimits.maxNodesPerWrite ?? 0;
            },
            // the WriteValues, decoded as the normal path does, written by the engine as there
            write: (context, nodesToWrite, count) => {
                const stream = new BinaryStream(Buffer.from(nodesToWrite.buffer, nodesToWrite.byteOffset, nodesToWrite.byteLength));
                stream.length = 4;
                const writeValues = new Array(count);
                for (let k = 0; k < count; k++) {
                    const writeValue = new WriteValue();
                    writeValue.decode(stream);
                    writeValues[k] = writeValue;
                }
                return engine.write(context, writeValues);
            }
        };
        return (channel, typeId, body, offset, requestId, securityHeader) => 
        // a listener of "request" sees every request: it gets them decoded
        this.listenerCount("request") === 0 &&
            (leanRead(host, channel, typeId, body, offset, requestId, securityHeader) ||
                leanWrite(writeHost, channel, typeId, body, offset, requestId, securityHeader));
    }
    /**
     * an ActivateSession refused: the session stays as it was (FrontOPCUAServer gives back one it took,
     * and the refusal is answered once it is back)
     */
    activationRefused(_session) {
        return undefined;
    }
    prepare(message, channel) {
        const request = message.request;
        // --- check that session is correct
        const authenticationToken = request.requestHeader.authenticationToken;
        const session = this.getSession(authenticationToken, /*activeOnly*/ true);
        if (!session) {
            message.session_statusCode = StatusCodes.BadSessionIdInvalid;
            return;
        }
        message.session = session;
        // --- check that provided session matches session attached to channel
        if (channel.channelId !== session.channelId) {
            if (!(request instanceof ActivateSessionRequest)) {
                // Note: PublishRequests arriving on the new channel before
                // ActivateSession completes the session transfer are expected
                // transient occurrences, not errors worth logging.
                if (request.constructor.name !== "PublishRequest") {
                    errorLog(chalk.red.bgWhite(`ERROR: channel.channelId !== session.channelId  on processing request ${request.constructor.name}`), channel.channelId, session.channelId);
                }
            }
            message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;
        }
        else if (channel_has_session(channel, session)) {
            message.session_statusCode = StatusCodes.Good;
        }
        else {
            // session ma y have been moved to a different channel
            message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;
        }
    }
    /**
     * ensure that action is performed on a valid session object,
     * @param ResponseClass the constructor of the response Class
     * @param message
     * @param channel
     * @param actionToPerform
     * @param actionToPerform.session {ServerSession}
     * @param actionToPerform.sendResponse
     * @param actionToPerform.sendResponse.response
     * @param actionToPerform.sendError
     * @param actionToPerform.sendError.statusCode
     * @param actionToPerform.sendError.diagnostics
     *
     * @private
     */
    async _apply_on_SessionObject(ResponseClass, message, channel, actionToPerform) {
        function sendResponse(response1) {
            try {
                if (message.session) {
                    const counterName = ResponseClass.schema.name.replace("Response", "");
                    message.session.incrementRequestTotalCounter(counterName);
                }
                return channel.send_response("MSG", response1, message);
            }
            catch (err) {
                warningLog(err);
                // c8 ignore next
                if (types.isNativeError(err)) {
                    // c8 ignore next
                    errorLog("Internal error in issuing response\nplease contact support@sterfive.com", message.request.toString(), "\n", response1.toString());
                }
                // c8 ignore next
                throw err;
            }
        }
        function sendError(statusCode) {
            if (message.session) {
                message.session.incrementRequestErrorCounter(ResponseClass.schema.name.replace("Response", ""));
            }
            return g_sendError(channel, message, ResponseClass, statusCode);
        }
        /* c8 ignore next */
        if (!message.session || message.session_statusCode !== StatusCodes.Good) {
            const sessionStatusCode = message.session_statusCode ?? StatusCodes.BadInternalError;
            const errMessage = `=>${sessionStatusCode.toString()}`;
            const response = new ServiceFault({
                responseHeader: { serviceResult: sessionStatusCode }
            });
            // c8 ignore next
            doDebug && debugLog(chalk.red.bold(errMessage), chalk.yellow(sessionStatusCode.toString()), response.constructor.name);
            return sendResponse(response);
        }
        assert(message.session_statusCode.isGood());
        // OPC UA Specification 1.02 part 4 page 26
        // When a  Session  is terminated, all outstanding requests on the  Session  are aborted and
        // Bad_SessionClosed  StatusCodes  are returned to the  Client. In addition,   the  Server  deletes the entry
        // for the  Client  from its  SessionDiagnostics Array  Variable  and notifies any other  Clients  who were
        // subscribed to this entry.
        if (message.session.status === "closed") {
            // note : use StatusCodes.BadSessionClosed , for pending message for this session
            return sendError(StatusCodes.BadSessionIdInvalid);
        }
        if (message.session.status === "new") {
            // mark session as being screwed ! so it cannot be activated anymore
            message.session.status = "screwed";
            return sendError(StatusCodes.BadSessionNotActivated);
        }
        if (message.session.status !== "active") {
            // mark session as being screwed ! so it cannot be activated anymore
            message.session.status = "screwed";
            // note : use StatusCodes.BadSessionClosed , for pending message for this session
            return sendError(StatusCodes.BadSessionIdInvalid);
        }
        // lets also reset the session watchdog so it doesn't
        // (Sessions are terminated by the Server automatically if the Client fails to issue a Service
        // request on the Session within the timeout period negotiated by the Server in the
        // CreateSession Service response. )
        if (message.session.keepAlive) {
            message.session.keepAlive();
        }
        message.session.incrementTotalRequestCount();
        await actionToPerform(message.session, sendResponse, sendError);
    }
    async _apply_on_Subscription(ResponseClass, message, channel, actionToPerform) {
        assert(typeof actionToPerform === "function");
        const request = message.request;
        assert(Object.hasOwn(request, "subscriptionId"));
        this._apply_on_SessionObject(ResponseClass, message, channel, async (session, sendResponse, sendError) => {
            const subscription = session.getSubscription(request.subscriptionId);
            if (!subscription) {
                return sendError(StatusCodes.BadSubscriptionIdInvalid);
            }
            subscription.resetLifeTimeAndKeepAliveCounters();
            await actionToPerform(session, subscription, sendResponse, sendError);
        });
    }
    _apply_on_SubscriptionIds(ResponseClass, message, channel, actionToPerform) {
        assert(typeof actionToPerform === "function");
        const request = message.request;
        assert(Object.hasOwn(request, "subscriptionIds"));
        this._apply_on_SessionObject(ResponseClass, message, channel, async (session, sendResponse, sendError) => {
            const subscriptionIds = request.subscriptionIds;
            if (!request.subscriptionIds || request.subscriptionIds.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            // check minimal
            if (request.subscriptionIds.length >
                Math.min(this.engine.serverCapabilities.maxSubscriptionsPerSession, this.engine.serverCapabilities.maxSubscriptions)) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
            const promises = subscriptionIds.map((subscriptionId) => actionToPerform(session, subscriptionId));
            const results = await Promise.all(promises);
            const serviceResult = StatusCodes.Good;
            const response = new ResponseClass({
                responseHeader: {
                    serviceResult
                },
                results: results
            });
            sendResponse(response);
        });
    }
    _apply_on_Subscriptions(ResponseClass, message, channel, actionToPerform) {
        this._apply_on_SubscriptionIds(ResponseClass, message, channel, async (session, subscriptionId) => {
            /* c8 ignore next */
            if (isSubscriptionIdInvalid(subscriptionId)) {
                return StatusCodes.BadSubscriptionIdInvalid;
            }
            const subscription = session.getSubscription(subscriptionId);
            if (!subscription) {
                return StatusCodes.BadSubscriptionIdInvalid;
            }
            return actionToPerform(session, subscription);
        });
    }
    async _closeSession(authenticationToken, deleteSubscriptions, reason, auditEntryId) {
        if (deleteSubscriptions && this.options.onDeleteMonitoredItem) {
            const session = this.getSession(authenticationToken);
            if (session) {
                const subscriptions = session.publishEngine.subscriptions;
                for (const subscription of subscriptions) {
                    const onDeleteFn = this.options.onDeleteMonitoredItem;
                    await subscription.applyOnMonitoredItem(async (monitoredItem) => {
                        await onDeleteFn(subscription, monitoredItem);
                    });
                }
            }
        }
        await this.engine.closeSession(authenticationToken, deleteSubscriptions, reason, auditEntryId);
    }
    /**
     * @param message
     * @param channel
     * @private
     */
    _on_CloseSessionRequest(message, channel) {
        const request = message.request;
        assert(request instanceof CloseSessionRequest);
        message.session_statusCode = StatusCodes.Good;
        function sendError(statusCode) {
            return g_sendError(channel, message, CloseSessionResponse, statusCode);
        }
        function sendResponse(response1) {
            channel.send_response("MSG", response1, message);
        }
        // do not use _apply_on_SessionObject
        // this._apply_on_SessionObject(CloseSessionResponse, message, channel, function (session) {
        // });
        const session = message.session;
        if (!session) {
            sendError(StatusCodes.BadSessionIdInvalid);
            return;
        }
        // OPC 10000-4 §5.6.4: a Session belongs to the SecureChannel that created it (or
        // that ActivateSession last rebound it to); ActivateSession is the only Service
        // allowed to move it. A CloseSession arriving on any other channel must be
        // rejected with Bad_SessionIdInvalid, otherwise a peer that merely learns another
        // Client's SessionId/AuthenticationToken could terminate that Client's Session
        // from an unrelated channel.
        if (session.channel !== channel) {
            sendError(StatusCodes.BadSessionIdInvalid);
            return;
        }
        // session has been created but not activated !
        const _wasNotActivated = session.status === "new";
        (async () => {
            try {
                await this._closeSession(request.requestHeader.authenticationToken, request.deleteSubscriptions, "CloseSession", request.requestHeader.auditEntryId ?? "");
                // if (false && wasNotActivated) {
                //  return sendError(StatusCodes.BadSessionNotActivated);
                // }
                const response = new CloseSessionResponse({});
                sendResponse(response);
            }
            catch (_err) {
                sendError(StatusCodes.BadInternalError);
            }
        })();
    }
    // browse services
    /**
     * @param message
     * @param channel
     * @private
     */
    _on_BrowseRequest(message, channel) {
        const request = message.request;
        assert(request instanceof BrowseRequest);
        const diagnostic = {};
        this._apply_on_SessionObject(BrowseResponse, message, channel, (session, sendResponse, sendError) => {
            let response;
            // test view
            if (request.view && !request.view.viewId.isEmpty()) {
                const addressSpace = this.engine.addressSpace;
                if (!addressSpace) {
                    return sendError(StatusCodes.BadInternalError);
                }
                let theView = addressSpace.findNode(request.view.viewId);
                if (theView && theView.nodeClass !== NodeClass.View) {
                    // Error: theView is not a View
                    diagnostic.localizedText = { text: "Expecting a view here" };
                    theView = null;
                }
                if (!theView) {
                    return sendError(StatusCodes.BadViewIdUnknown);
                }
            }
            if (!request.nodesToBrowse || request.nodesToBrowse.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerBrowse > 0) {
                if (request.nodesToBrowse.length > this.engine.serverCapabilities.operationLimits.maxNodesPerBrowse) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // limit results to requestedMaxReferencesPerNode further so it never exceed a too big number
            const requestedMaxReferencesPerNode = Math.min(9876, request.requestedMaxReferencesPerNode);
            assert(request.nodesToBrowse[0].schema.name === "BrowseDescription");
            const context = session.sessionContext;
            const browseAll = (_nodesToBrowse, callack) => {
                const f = callbackify(this.engine.browseWithAutomaticExpansion).bind(this.engine);
                f(request.nodesToBrowse ?? [], context, callack);
            };
            // handle continuation point and requestedMaxReferencesPerNode
            const maxBrowseContinuationPoints = this.engine.serverCapabilities.maxBrowseContinuationPoints;
            innerBrowse({
                browseAll,
                context,
                continuationPointManager: session.continuationPointManager,
                requestedMaxReferencesPerNode,
                maxBrowseContinuationPoints
            }, request.nodesToBrowse, (_err, results) => {
                if (!results) {
                    return sendError(StatusCodes.BadInternalError);
                }
                assert(results[0].schema.name === "BrowseResult");
                response = new BrowseResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            });
        });
    }
    /**
     */
    _on_BrowseNextRequest(message, channel) {
        const request = message.request;
        assert(request instanceof BrowseNextRequest);
        this._apply_on_SessionObject(BrowseNextResponse, message, channel, (session, sendResponse, sendError) => {
            if (!request.continuationPoints || request.continuationPoints.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            innerBrowseNext({
                continuationPointManager: session.continuationPointManager
            }, request.continuationPoints, request.releaseContinuationPoints, (err, results) => {
                if (err) {
                    return sendError(StatusCodes.BadInternalError);
                }
                const response = new BrowseNextResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            });
        });
    }
    // read services
    _on_ReadRequest(message, channel) {
        const request = message.request;
        this._apply_on_SessionObject(ReadResponse, message, channel, (session, sendResponse, sendError) => {
            const context = session.sessionContext;
            const timestampsToReturn = request.timestampsToReturn;
            if (timestampsToReturn === TimestampsToReturn.Invalid) {
                return sendError(StatusCodes.BadTimestampsToReturnInvalid);
            }
            if (request.maxAge < 0) {
                return sendError(StatusCodes.BadMaxAgeInvalid);
            }
            request.nodesToRead = request.nodesToRead || [];
            if (!request.nodesToRead || request.nodesToRead.length <= 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            // limit size of nodesToRead array to maxNodesPerRead
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
                if (request.nodesToRead.length > this.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // proceed with registered nodes alias resolution
            for (const nodeToRead of request.nodesToRead) {
                nodeToRead.nodeId = session.resolveRegisteredNode(nodeToRead.nodeId);
            }
            // ask for a refresh of asynchronous variables, then read: the whole of it runs
            // before this handler returns when no Variable is asynchronous, which is the
            // common case, and the response leaves with the others of the same tick
            this.engine.prepareRead(context, request, (_err) => {
                let results;
                try {
                    results = this.engine.readSync(context, request);
                }
                catch (err) {
                    errorLog("Read: internal error", err.message);
                    return sendError(StatusCodes.BadInternalError);
                }
                assert(results.length === request.nodesToRead?.length);
                // null: the response is built with its defaults set directly, rather
                // than through the schema, field by field, header included
                const response = new ReadResponse(null);
                // set it here for performance
                response.results = results;
                sendResponse(response);
            });
        });
    }
    // read services
    _on_HistoryReadRequest(message, channel) {
        const request = message.request;
        assert(request instanceof HistoryReadRequest);
        this._apply_on_SessionObject(HistoryReadResponse, message, channel, (session, sendResponse, sendError) => {
            const timestampsToReturn = request.timestampsToReturn;
            if (timestampsToReturn === TimestampsToReturn.Invalid) {
                return sendError(StatusCodes.BadTimestampsToReturnInvalid);
            }
            request.nodesToRead = request.nodesToRead || [];
            if (!request.nodesToRead || request.nodesToRead.length <= 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            assert(request.nodesToRead[0].schema.name === "HistoryReadValueId");
            // limit size of nodesToRead array to maxNodesPerRead
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
                if (request.nodesToRead.length > this.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // todo : handle
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData > 0) {
                if (request.nodesToRead.length > this.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents > 0) {
                if (request.nodesToRead.length > this.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            const context = session.sessionContext;
            // ask for a refresh of asynchronous variables
            this.engine.refreshValues(request.nodesToRead, 0, (err) => {
                assert(!err, " error not handled here , fix me"); // TODO
                this.engine
                    .historyRead(context, request)
                    .then((results) => {
                    assert(results[0].schema.name === "HistoryReadResult");
                    assert(results.length === request.nodesToRead?.length);
                    const response = new HistoryReadResponse({
                        diagnosticInfos: undefined,
                        results
                    });
                    assert(response.diagnosticInfos?.length === 0);
                    sendResponse(response);
                })
                    .catch((_err) => {
                    return sendError(StatusCodes.BadHistoryOperationInvalid);
                });
            }, context);
        });
    }
    /*
   // write services
   // OPCUA Specification 1.02 Part 3 : 5.10.4 Write
   // This Service is used to write values to one or more Attributes of one or more Nodes. For constructed
   // Attribute values whose elements are indexed, such as an array, this Service allows Clients to write
   // the entire set of indexed values as a composite, to write individual elements or to write ranges of
   // elements of the composite.
   // The values are written to the data source, such as a device, and the Service does not return until it writes
   // the values or determines that the value cannot be written. In certain cases, the Server will successfully
   // to an intermediate system or Server, and will not know if the data source was updated properly. In these cases,
   // the Server should report a success code that indicates that the write was not verified.
   // In the cases where the Server is able to verify that it has successfully written to the data source,
   // it reports an unconditional success.
   */
    _on_WriteRequest(message, channel) {
        const request = message.request;
        assert(request instanceof WriteRequest);
        assert(!request.nodesToWrite || Array.isArray(request.nodesToWrite));
        this._apply_on_SessionObject(WriteResponse, message, channel, (session, sendResponse, sendError) => {
            if (!request.nodesToWrite || request.nodesToWrite.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerWrite > 0) {
                if (request.nodesToWrite.length > this.engine.serverCapabilities.operationLimits.maxNodesPerWrite) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // proceed with registered nodes alias resolution
            let aliased = false;
            for (const nodeToWrite of request.nodesToWrite) {
                const nodeId = session.resolveRegisteredNode(nodeToWrite.nodeId);
                aliased ||= nodeId !== nodeToWrite.nodeId;
                nodeToWrite.nodeId = nodeId;
            }
            if (aliased) {
                // the bytes the WriteValues arrived as name the aliases, not the nodes
                forgetEncodedNodesToWrite(request.nodesToWrite);
            }
            const context = session.sessionContext;
            assert(request.nodesToWrite[0].schema.name === "WriteValue");
            this.engine
                .write(context, request.nodesToWrite)
                .then((results) => {
                assert(results?.length === request.nodesToWrite?.length);
                const response = new WriteResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            })
                .catch((err) => {
                errorLog(err);
                sendError(StatusCodes.BadInternalError);
            });
        });
    }
    // subscription services
    _on_CreateSubscriptionRequest(message, channel) {
        const engine = this.engine;
        if (!this.engineServesSubscriptions()) {
            g_sendError(channel, message, CreateSubscriptionResponse, StatusCodes.BadSessionClosed);
            return;
        }
        const request = message.request;
        assert(request instanceof CreateSubscriptionRequest);
        this._apply_on_SessionObject(CreateSubscriptionResponse, message, channel, (session, sendResponse, sendError) => {
            const context = session.sessionContext;
            if (session.currentSubscriptionCount >= this.engine.serverCapabilities.maxSubscriptionsPerSession) {
                return sendError(StatusCodes.BadTooManySubscriptions);
            }
            if (this.currentSubscriptionCount >= this.engine.serverCapabilities.maxSubscriptions) {
                return sendError(StatusCodes.BadTooManySubscriptions);
            }
            const subscription = session.createSubscription(request);
            subscription.on("monitoredItem", (monitoredItem) => {
                prepareMonitoredItem(context, engine.nodeFinder, monitoredItem);
            });
            const response = new CreateSubscriptionResponse({
                revisedLifetimeCount: subscription.lifeTimeCount,
                revisedMaxKeepAliveCount: subscription.maxKeepAliveCount,
                revisedPublishingInterval: subscription.publishingInterval,
                subscriptionId: subscription.id
            });
            sendResponse(response);
        });
    }
    _on_DeleteSubscriptionsRequest(message, channel) {
        const request = message.request;
        assert(request instanceof DeleteSubscriptionsRequest);
        this._apply_on_SubscriptionIds(DeleteSubscriptionsResponse, message, channel, async (session, subscriptionId) => {
            let subscription = this.engine.findOrphanSubscription(subscriptionId);
            // c8 ignore next
            if (subscription) {
                // OPC 10000-4: only the owning user may delete an orphaned subscription, the same
                // ownership rule TransferSubscriptions enforces. Check before the pre-delete hook
                // runs or anything is destroyed.
                if (!this.engine.mayDeleteOrphanSubscription(session, subscription)) {
                    return StatusCodes.BadUserAccessDenied;
                }
                warningLog("Deleting an orphan subscription", subscriptionId);
                await this._beforeDeleteSubscription(subscription);
                return this.engine.deleteOrphanSubscription(subscription);
            }
            subscription = session.getSubscription(subscriptionId);
            if (subscription) {
                await this._beforeDeleteSubscription(subscription);
            }
            return session.deleteSubscription(subscriptionId);
        });
    }
    _on_TransferSubscriptionsRequest(message, channel) {
        //
        // sendInitialValue Boolean
        //    A Boolean parameter with the following values:
        //    TRUE      the first Publish response(s) after the TransferSubscriptions call shall
        //              contain the current values of all Monitored Items in the Subscription where
        //              the Monitoring Mode is set to Reporting.
        //    FALSE     the first Publish response after the TransferSubscriptions call shall contain only the value
        //              changes since the last Publish response was sent.
        //    This parameter only applies to MonitoredItems used for monitoring Attribute changes.
        //
        const engine = this.engine;
        const request = message.request;
        assert(request instanceof TransferSubscriptionsRequest);
        this._apply_on_SubscriptionIds(TransferSubscriptionsResponse, message, channel, async (session, subscriptionId) => await engine.transferSubscription(session, subscriptionId, request.sendInitialValues));
    }
    _on_CreateMonitoredItemsRequest(message, channel) {
        const engine = this.engine;
        if (!this.engineServesSubscriptions()) {
            g_sendError(channel, message, CreateMonitoredItemsResponse, StatusCodes.BadSessionClosed);
            return;
        }
        const request = message.request;
        assert(request instanceof CreateMonitoredItemsRequest);
        this._apply_on_Subscription(CreateMonitoredItemsResponse, message, channel, async (session, subscription, sendResponse, sendError) => {
            const timestampsToReturn = request.timestampsToReturn;
            if (timestampsToReturn === TimestampsToReturn.Invalid) {
                return sendError(StatusCodes.BadTimestampsToReturnInvalid);
            }
            if (!request.itemsToCreate || request.itemsToCreate.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                if (request.itemsToCreate.length > this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // the nodes of a front thread's compact namespaces are described by its engine first
            const preparing = engine.prepareMonitoredItems(session.sessionContext, request.itemsToCreate);
            if (preparing) {
                await preparing;
            }
            const options = this.options;
            let results = [];
            if (options.onCreateMonitoredItem) {
                const resultsPromise = request.itemsToCreate.map(async (monitoredItemCreateRequest) => {
                    const { monitoredItem, createResult } = subscription.preCreateMonitoredItem(engine.nodeFinder, timestampsToReturn, monitoredItemCreateRequest);
                    if (monitoredItem) {
                        if (options.onCreateMonitoredItem) {
                            await options.onCreateMonitoredItem(subscription, monitoredItem);
                        }
                        subscription.postCreateMonitoredItem(monitoredItem, monitoredItemCreateRequest, createResult);
                    }
                    return createResult;
                });
                results = await Promise.all(resultsPromise);
            }
            else {
                results = request.itemsToCreate.map((monitoredItemCreateRequest) => {
                    const { monitoredItem, createResult } = subscription.preCreateMonitoredItem(engine.nodeFinder, timestampsToReturn, monitoredItemCreateRequest);
                    if (monitoredItem) {
                        subscription.postCreateMonitoredItem(monitoredItem, monitoredItemCreateRequest, createResult);
                    }
                    return createResult;
                });
            }
            // a session worker's engine watches the items before the client hears of them
            const ready = engine.monitoredItemsReady();
            if (ready) {
                await ready;
            }
            const response = new CreateMonitoredItemsResponse({
                responseHeader: { serviceResult: StatusCodes.Good },
                results
                // ,diagnosticInfos: []
            });
            sendResponse(response);
        });
    }
    _on_ModifySubscriptionRequest(message, channel) {
        const request = message.request;
        assert(request instanceof ModifySubscriptionRequest);
        this._apply_on_Subscription(ModifySubscriptionResponse, message, channel, async (_session, subscription, sendResponse, _sendError) => {
            subscription.modify(request);
            const response = new ModifySubscriptionResponse({
                revisedLifetimeCount: subscription.lifeTimeCount,
                revisedMaxKeepAliveCount: subscription.maxKeepAliveCount,
                revisedPublishingInterval: subscription.publishingInterval
            });
            sendResponse(response);
        });
    }
    _on_ModifyMonitoredItemsRequest(message, channel) {
        const request = message.request;
        assert(request instanceof ModifyMonitoredItemsRequest);
        this._apply_on_Subscription(ModifyMonitoredItemsResponse, message, channel, async (_session, subscription, sendResponse, sendError) => {
            const timestampsToReturn = request.timestampsToReturn;
            if (timestampsToReturn === TimestampsToReturn.Invalid) {
                return sendError(StatusCodes.BadTimestampsToReturnInvalid);
            }
            if (!request.itemsToModify || request.itemsToModify.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            /* c8 ignore next */
            if (this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                if (request.itemsToModify.length > this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            const itemsToModify = request.itemsToModify; // MonitoredItemModifyRequest
            function modifyMonitoredItem(item) {
                const monitoredItemId = item.monitoredItemId;
                const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
                if (!monitoredItem) {
                    return new MonitoredItemModifyResult({
                        statusCode: StatusCodes.BadMonitoredItemIdInvalid
                    });
                }
                // adjust samplingInterval if === -1
                if (item.requestedParameters.samplingInterval === -1) {
                    item.requestedParameters.samplingInterval = subscription.publishingInterval;
                }
                return monitoredItem.modify(timestampsToReturn, item.requestedParameters);
            }
            const results = itemsToModify.map(modifyMonitoredItem);
            const response = new ModifyMonitoredItemsResponse({
                results
            });
            sendResponse(response);
        });
    }
    _on_PublishRequest(message, channel) {
        const request = message.request;
        assert(request instanceof PublishRequest);
        this._apply_on_SessionObject(PublishResponse, message, channel, (session, sendResponse, _sendError) => {
            assert(session);
            assert(session.publishEngine); // server.publishEngine doesn't exists, OPCUAServer has probably shut down already
            session.publishEngine._on_PublishRequest(request, (_request1, response) => {
                sendResponse(response);
            });
        });
    }
    _on_SetPublishingModeRequest(message, channel) {
        const request = message.request;
        assert(request instanceof SetPublishingModeRequest);
        const publishingEnabled = request.publishingEnabled;
        this._apply_on_Subscriptions(SetPublishingModeResponse, message, channel, async (_session, subscription) => {
            return subscription.setPublishingMode(publishingEnabled);
        });
    }
    _on_DeleteMonitoredItemsRequest(message, channel) {
        const request = message.request;
        assert(request instanceof DeleteMonitoredItemsRequest);
        this._apply_on_Subscription(DeleteMonitoredItemsResponse, message, channel, async (_session, subscription, sendResponse, sendError) => {
            /* c8 ignore next */
            if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            /* c8 ignore next */
            if (this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                if (request.monitoredItemIds.length > this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            try {
                // The onDeleteMonitoredItem hook is per item and may be async, so it
                // still runs one at a time. The removal itself is done for the whole
                // batch, in a single pass over the pending notifications instead of
                // one pass per item.
                if (this.options.onDeleteMonitoredItem) {
                    for (const monitoredItemId of request.monitoredItemIds) {
                        const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
                        if (monitoredItem) {
                            await this.options.onDeleteMonitoredItem(subscription, monitoredItem);
                        }
                    }
                }
                const results = subscription.removeMonitoredItems(request.monitoredItemIds);
                const response = new DeleteMonitoredItemsResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            }
            catch (err) {
                warningLog(err);
                return sendError(StatusCodes.BadInternalError);
            }
        });
    }
    _on_SetTriggeringRequest(message, channel) {
        const request = message.request;
        assert(request instanceof SetTriggeringRequest);
        this._apply_on_Subscription(SetTriggeringResponse, message, channel, async (_session, subscription, sendResponse, sendError) => {
            /* */
            const { triggeringItemId, linksToAdd, linksToRemove } = request;
            /**
             * The MaxMonitoredItemsPerCall Property indicates
             * [...]
             *  • the maximum size of the sum of the linksToAdd and linksToRemove arrays when a
             *    Client calls the SetTriggering Service.
             *
             */
            const maxElements = (linksToAdd ? linksToAdd.length : 0) + (linksToRemove ? linksToRemove.length : 0);
            if (this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                if (maxElements > this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            const { addResults, removeResults, statusCode } = subscription.setTriggering(triggeringItemId, linksToAdd, linksToRemove);
            if (statusCode.isNotGood()) {
                const response = new ServiceFault({
                    responseHeader: { serviceResult: statusCode }
                });
                sendResponse(response);
            }
            else {
                const response = new SetTriggeringResponse({
                    responseHeader: { serviceResult: statusCode },
                    addResults,
                    removeResults,
                    addDiagnosticInfos: null,
                    removeDiagnosticInfos: null
                });
                sendResponse(response);
            }
        });
    }
    async _beforeDeleteSubscription(subscription) {
        if (!this.options.onDeleteMonitoredItem) {
            return;
        }
        const t = this.options.onDeleteMonitoredItem.bind(null, subscription);
        const functor = async (monitoredItem) => {
            await t(monitoredItem);
        };
        await subscription.applyOnMonitoredItem(functor);
    }
    _on_RepublishRequest(message, channel) {
        const request = message.request;
        assert(request instanceof RepublishRequest);
        this._apply_on_Subscription(RepublishResponse, message, channel, async (_session, subscription, sendResponse, sendError) => {
            // update diagnostic counter
            subscription.subscriptionDiagnostics.republishRequestCount += 1;
            subscription.subscriptionDiagnostics.republishMessageRequestCount += 1;
            const retransmitSequenceNumber = request.retransmitSequenceNumber;
            const notificationMessage = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);
            if (!notificationMessage) {
                return sendError(StatusCodes.BadMessageNotAvailable);
            }
            const response = new RepublishResponse({
                notificationMessage,
                responseHeader: {
                    serviceResult: StatusCodes.Good
                }
            });
            // update diagnostic counter
            subscription.subscriptionDiagnostics.republishMessageCount += 1;
            sendResponse(response);
        });
    }
    // Bad_NothingToDo
    // Bad_TooManyOperations
    // Bad_SubscriptionIdInvalid
    // Bad_MonitoringModeInvalid
    _on_SetMonitoringModeRequest(message, channel) {
        const request = message.request;
        assert(request instanceof SetMonitoringModeRequest);
        this._apply_on_Subscription(SetMonitoringModeResponse, message, channel, async (_session, subscription, sendResponse, sendError) => {
            /* c8 ignore next */
            if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            /* c8 ignore next */
            if (this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                if (request.monitoredItemIds.length > this.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            const monitoringMode = request.monitoringMode;
            if (!isMonitoringModeValid(monitoringMode)) {
                return sendError(StatusCodes.BadMonitoringModeInvalid);
            }
            const results = request.monitoredItemIds.map((monitoredItemId) => {
                const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
                if (!monitoredItem) {
                    return StatusCodes.BadMonitoredItemIdInvalid;
                }
                const statusCode = monitoredItem.setMonitoringMode(monitoringMode);
                return statusCode;
            });
            // an item that starts sampling is watched by a session worker's engine before the client hears of it
            const ready = this.engine.monitoredItemsReady();
            if (ready) {
                await ready;
            }
            const response = new SetMonitoringModeResponse({
                results
            });
            sendResponse(response);
        });
    }
    // _on_TranslateBrowsePathsToNodeIds service
    _on_TranslateBrowsePathsToNodeIdsRequest(message, channel) {
        const request = message.request;
        assert(request instanceof TranslateBrowsePathsToNodeIdsRequest);
        this._apply_on_SessionObject(TranslateBrowsePathsToNodeIdsResponse, message, channel, async (session, sendResponse, sendError) => {
            if (!request.browsePaths || request.browsePaths.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds > 0) {
                if (request.browsePaths.length >
                    this.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            this.engine
                .translateBrowsePaths(request.browsePaths, session.sessionContext)
                .then((browsePathsResults) => {
                const response = new TranslateBrowsePathsToNodeIdsResponse({
                    diagnosticInfos: null,
                    results: browsePathsResults
                });
                sendResponse(response);
            })
                .catch((_err) => {
                sendError(StatusCodes.BadInternalError);
            });
        });
    }
    // Call Service Result Codes
    // Symbolic Id Description
    // Bad_NothingToDo       See Table 165 for the description of this result code.
    // Bad_TooManyOperations See Table 165 for the description of this result code.
    //
    _on_CallRequest(message, channel) {
        const request = message.request;
        assert(request instanceof CallRequest);
        this._apply_on_SessionObject(CallResponse, message, channel, (session, sendResponse, sendError) => {
            if (!request.methodsToCall || request.methodsToCall.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            // the MaxNodesPerMethodCall Property indicates the maximum size of the methodsToCall array when
            // a Client calls the Call Service.
            let maxNodesPerMethodCall = this.engine.serverCapabilities.operationLimits.maxNodesPerMethodCall;
            maxNodesPerMethodCall = maxNodesPerMethodCall <= 0 ? 1000 : maxNodesPerMethodCall;
            if (request.methodsToCall.length > maxNodesPerMethodCall) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
            // a fresh per-call context, never session.sessionContext itself: see
            // SessionContext#withRequestHeader for why that instance must stay untouched.
            // A context an application substituted that is not a SessionContext is used as is
            // (its method handlers then see no RequestHeader).
            const sessionContext = session.sessionContext;
            const context = sessionContext instanceof SessionContext
                ? sessionContext.withRequestHeader(request.requestHeader)
                : sessionContext;
            this.engine
                .call(context, request.methodsToCall)
                .then((results) => {
                const stringTable = [];
                const response = new CallResponse({
                    results: results.map(({ diagnosticInfo: _, statusText: __, ...result }) => result),
                    diagnosticInfos: callResultDiagnosticInfos(request.requestHeader.returnDiagnostics, results, stringTable)
                });
                if (stringTable.length > 0) {
                    response.responseHeader.stringTable = stringTable;
                }
                filterDiagnosticInfo(request.requestHeader.returnDiagnostics, response);
                sendResponse(response);
            })
                .catch((_err) => {
                sendError(StatusCodes.BadInternalError);
            });
        });
    }
    _on_RegisterNodesRequest(message, channel) {
        const request = message.request;
        assert(request instanceof RegisterNodesRequest);
        this._apply_on_SessionObject(RegisterNodesResponse, message, channel, (session, sendResponse, sendError) => {
            if (!request.nodesToRegister || request.nodesToRegister.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
                if (request.nodesToRegister.length > this.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            // A list of NodeIds which the Client shall use for subsequent access operations. The
            // size and order of this list matches the size and order of the nodesToRegister
            // request parameter.
            // The Server may return the NodeId from the request or a new (an alias) NodeId. It
            // is recommended that the Server return a numeric NodeIds for aliasing.
            // In case no optimization is supported for a Node, the Server shall return the
            // NodeId from the request.
            const registeredNodeIds = request.nodesToRegister.map((nodeId) => session.registerNode(nodeId));
            const response = new RegisterNodesResponse({
                registeredNodeIds
            });
            sendResponse(response);
        });
    }
    _on_UnregisterNodesRequest(message, channel) {
        const request = message.request;
        assert(request instanceof UnregisterNodesRequest);
        this._apply_on_SessionObject(UnregisterNodesResponse, message, channel, (session, sendResponse, sendError) => {
            request.nodesToUnregister = request.nodesToUnregister || [];
            if (!request.nodesToUnregister || request.nodesToUnregister.length === 0) {
                return sendError(StatusCodes.BadNothingToDo);
            }
            if (this.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
                if (request.nodesToUnregister.length > this.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }
            }
            request.nodesToUnregister.map((nodeId) => session.unRegisterNode(nodeId));
            const response = new UnregisterNodesResponse({});
            sendResponse(response);
        });
    }
    /* c8 ignore next */
    _on_Cancel(message, channel) {
        g_sendError(channel, message, CancelResponse, StatusCodes.BadServiceUnsupported);
    }
    // NodeManagement Service Set Overview
    // This Service Set defines Services to add and delete AddressSpace Nodes and References between them. All added
    // Nodes continue to exist in the AddressSpace even if the Client that created them disconnects from the Server.
    //
    /* c8 ignore next */
    _on_AddNodes(message, channel) {
        g_sendError(channel, message, AddNodesResponse, StatusCodes.BadServiceUnsupported);
    }
    /* c8 ignore next */
    _on_AddReferences(message, channel) {
        g_sendError(channel, message, AddReferencesResponse, StatusCodes.BadServiceUnsupported);
    }
    /* c8 ignore next */
    _on_DeleteNodes(message, channel) {
        g_sendError(channel, message, DeleteNodesResponse, StatusCodes.BadServiceUnsupported);
    }
    /* c8 ignore next */
    _on_DeleteReferences(message, channel) {
        g_sendError(channel, message, DeleteReferencesResponse, StatusCodes.BadServiceUnsupported);
    }
    // Query Service
    /* c8 ignore next */
    _on_QueryFirst(message, channel) {
        g_sendError(channel, message, QueryFirstResponse, StatusCodes.BadServiceUnsupported);
    }
    /* c8 ignore next */
    _on_QueryNext(message, channel) {
        g_sendError(channel, message, QueryNextResponse, StatusCodes.BadServiceUnsupported);
    }
    /* c8 ignore next */
    _on_HistoryUpdate(message, channel) {
        g_sendError(channel, message, HistoryUpdateResponse, StatusCodes.BadServiceUnsupported);
    }
    createEndpoint(port1, serverOptions) {
        const serverProvider = this.getProvider();
        const hasOpaqueKey = serverProvider instanceof OpaqueCertificateKeyPairProvider;
        // Give the endpoint its own DiskCertificateKeyPairProvider — a
        // separate instance from the server's own provider (see the
        // invalidation-semantics note below). A resolved provider
        // (passphrase-encrypted key) or an opaque one (HSM/KMS-held key) is
        // reused instead: neither can be rebuilt from files.
        const endpointProvider = serverProvider instanceof ResolvedCertificateKeyPairProvider || hasOpaqueKey
            ? serverProvider
            : new DiskCertificateKeyPairProvider(this.certificateFile, this.privateKeyFile);
        // add the tcp/ip endpoint with no security
        const endPoint = new OPCUAServerEndPoint({
            port: port1,
            host: serverOptions.host,
            reusePort: serverOptions.reusePort,
            certificateManager: this.serverCertificateManager,
            certificateKeyPairProvider: endpointProvider,
            defaultSecureTokenLifetime: serverOptions.defaultSecureTokenLifetime || 600000,
            timeout: serverOptions.timeout || 3 * 60 * 1000,
            maxConnections: this.maxConnectionsPerEndpoint,
            objectFactory: this.objectFactory,
            serverInfo: this.serverInfo,
            transportSettings: serverOptions.transportSettings
        });
        // Invalidation-semantics note: the fresh per-endpoint disk provider
        // matters because OPCUASecureObject#invalidateCachedCertificates()
        // (called directly, e.g. after a manual on-disk cert/key swap) only
        // invalidates the server's own provider, not any endpoint's — a
        // *shared* disk provider instance would leave the endpoint's own
        // OPCUAServerEndPoint#getCombinedCertificate() cache stale. Push
        // certificate management replaces the endpoint's provider via
        // endpoint.setCertificateProvider() when installing new cert paths.
        return endPoint;
    }
    createEndpointDescriptions(serverOption, endpointOptions) {
        /* c8 ignore next */
        if (!endpointOptions) {
            throw new Error("internal error");
        }
        const hostname = getFullyQualifiedDomainName();
        endpointOptions.hostname = endpointOptions.hostname || hostname;
        endpointOptions.port = endpointOptions.port === undefined ? 26543 : endpointOptions.port;
        /* c8 ignore next */
        if (!Object.hasOwn(endpointOptions, "port") ||
            !Number.isFinite(endpointOptions.port) ||
            typeof endpointOptions.port !== "number") {
            throw new Error("expecting a valid port (number) when specified. alternatively you can specify port:0 and node-opcua will choose the first available port");
        }
        const port = Number(endpointOptions.port || 0);
        // the listener settings of an `endpoints[]` entry win over the top-level ones,
        // which stay the fallback (and are the only source for the implicit endpoint)
        const endPoint = this.createEndpoint(port, {
            ...serverOption,
            host: endpointOptions.host ?? serverOption.host,
            reusePort: endpointOptions.reusePort ?? serverOption.reusePort
        });
        endpointOptions.alternateHostname = endpointOptions.alternateHostname || [];
        const alternateHostname = Array.isArray(endpointOptions.alternateHostname)
            ? endpointOptions.alternateHostname
            : [endpointOptions.alternateHostname];
        const allowAnonymous = endpointOptions.allowAnonymous === undefined ? true : !!endpointOptions.allowAnonymous;
        const userTokenTypes = resolveUserTokenTypes(endpointOptions.userTokenTypes, allowAnonymous);
        endPoint.addStandardEndpointDescriptions({
            allowAnonymous,
            securityModes: endpointOptions.securityModes,
            securityPolicies: endpointOptions.securityPolicies,
            hostname: endpointOptions.hostname,
            alternateHostname,
            disableDiscovery: !!endpointOptions.disableDiscovery,
            // xx                hostname,
            resourcePath: serverOption.resourcePath || "",
            advertisedEndpoints: endpointOptions.advertisedEndpoints,
            // undefined => addStandardEndpointDescriptions uses its defaults
            userTokenTypes,
            allowUnsecurePassword: endpointOptions.allowUnsecurePassword === true
        });
        return endPoint;
    }
    async initializeCM() {
        await super.initializeCM();
        await this.userCertificateManager.initialize();
    }
}
/** the OPC UA server, with its engine and address space in this thread */
export class OPCUAServer extends OPCUAServerCore {
    static defaultShutdownTimeout = 100; // 250 ms
    /**
     * if requestExactEndpointUrl is set to true the server will only accept createSession that have a endpointUrl that strictly matches
     * one of the provided endpoint.
     * This mean that if the server expose a endpoint with url such as opc.tcp://MYHOSTNAME:1234, client will not be able to reach the server
     * with the ip address of the server.
     * requestExactEndpointUrl = true => emulates the Prosys Server behavior
     * requestExactEndpointUrl = false => emulates the Unified Automation behavior.
     */
    static requestExactEndpointUrl = g_requestExactEndpointUrl;
    static registry = new ObjectRegistry();
    static fallbackSessionName = "Client didn't provide a meaningful sessionName ...";
    /**
     * the maximum number of subscription that can be created per server
     * @deprecated
     */
    static deprecated_MAX_SUBSCRIPTION = 50;
    createEngine(options) {
        return new ServerEngine(options);
    }
}
const userIdentityTokenPasswordRemoved = (userIdentityToken) => {
    if (!userIdentityToken)
        return new AnonymousIdentityToken();
    const a = userIdentityToken.clone();
    // For Username/Password tokens the password shall not be included.
    if (a instanceof UserNameIdentityToken) {
        // remove password
        a.password = Buffer.from("*************", "ascii");
    }
    // An IssuedIdentityToken's tokenData is a bearer credential (e.g. a JWT): whoever holds it can
    // present it again. OPC 10000-2 v1.05.06 §4.14 warns that audit records may carry sensitive data, so it
    // is masked the same way as a password. X509 certificateData is public and stays.
    if (a instanceof IssuedIdentityToken) {
        a.tokenData = Buffer.from("*************", "ascii");
    }
    // if (a instanceof X509IdentityToken) {
    //     a.certificateData = Buffer.alloc(0);
    // }
    return a;
};
/**
 * Raises the AuditActivateSessionEventType of one ActivateSession call (OPC 10000-5 v1.05.06 §6.4.10), for
 * its success or, with `failure`, for its rejection. `session` is null when the request named no
 * known Session: OPC 10000-5 v1.05.06 §6.4.7 "If no session context exists [...] the SessionId shall be null."
 */
function raiseAuditActivateSessionEventType(session, auditEntryId, failure) {
    if (this.isAuditing) {
        const userIdentityToken = failure ? failure.userIdentityToken : session?.userIdentityToken;
        const channelId = failure ? failure.channel.channelId : session?.channel?.channelId;
        this.raiseEvent("AuditActivateSessionEventType", {
            /* part 5 -  6.4.3 AuditEventType */
            actionTimeStamp: { dataType: "DateTime", value: new Date() },
            status: { dataType: "Boolean", value: !failure },
            severity: { dataType: "UInt16", value: failure ? AUDIT_SEVERITY_SECURITY_FAILURE : AUDIT_SEVERITY_INFO },
            // OPC 10000-4 v1.05.07 §6.5.6: "For the failure case the Message for Events of this type should
            // include a description of why the Service failed."
            ...(failure
                ? {
                    message: {
                        dataType: "LocalizedText",
                        value: { text: `ActivateSession rejected: ${failure.statusCode.name}` }
                    }
                }
                : {}),
            serverId: { dataType: "String", value: this.serverInfo.applicationUri || "" },
            // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
            clientAuditEntryId: { dataType: "String", value: auditEntryId },
            // The ClientUserId identifies the user of the client requesting an action.
            // The ClientUserId can be obtained from the UserIdentityToken passed in the
            // ActivateSession call.
            clientUserId: { dataType: "String", value: getClientUserIdForAudit(userIdentityToken) },
            sourceName: { dataType: "String", value: "Session/ActivateSession" },
            /* part 5 - 6.4.7 AuditSessionEventType */
            sessionId: { dataType: "NodeId", value: session ? session.nodeId : new NodeId() },
            /* part 5 - 6.4.10 AuditActivateSessionEventType */
            clientSoftwareCertificates: {
                arrayType: VariantArrayType.Array,
                dataType: "ExtensionObject" /* SignedSoftwareCertificate */,
                value: []
            },
            // UserIdentityToken reflects the userIdentityToken parameter of the ActivateSession
            // Service call.
            // For Username/Password tokens the password should NOT be included.
            userIdentityToken: {
                dataType: "ExtensionObject" /*  UserIdentityToken */,
                value: userIdentityTokenPasswordRemoved(userIdentityToken ?? undefined)
            },
            // SecureChannelId shall uniquely identify the SecureChannel. The application shall
            // use the same identifier in all AuditEvents related to the Session Service Set
            // (AuditCreateSessionEventType, AuditActivateSessionEventType and their subtypes) and
            // the SecureChannel Service Set (AuditChannelEventType and its subtypes).
            secureChannelId: {
                dataType: "String",
                value: channelId?.toString() ?? ""
            }
        });
    }
}
const opts = { multiArgs: false };
OPCUAServerCore.prototype.initialize = withCallback(OPCUAServerCore.prototype.initialize, opts);
OPCUAServerCore.prototype.shutdown = withCallback(OPCUAServerCore.prototype.shutdown, opts);
//# sourceMappingURL=opcua_server.js.map