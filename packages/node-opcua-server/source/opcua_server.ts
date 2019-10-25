/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
// tslint:disable:max-line-length
// tslint:disable:unified-signatures
import * as async from "async";
import chalk from "chalk";
import * as crypto from "crypto";
import { EventEmitter } from "events";
import * as _ from "underscore";
import { callbackify } from "util";

import { extractFullyQualifiedDomainName } from "node-opcua-hostname";

import { assert } from "node-opcua-assert";
import * as utils from "node-opcua-utils";

import {
    AddressSpace,
    callMethodHelper,
    ContinuationPoint,
    getMethodDeclaration_ArgumentList,
    IServerBase,
    ISessionBase,
    IUserManager,
    PseudoVariantBoolean,
    PseudoVariantByteString,
    PseudoVariantDateTime,
    PseudoVariantDuration,
    PseudoVariantExtensionObject,
    PseudoVariantExtensionObjectArray,
    PseudoVariantLocalizedText,
    PseudoVariantNodeId,
    PseudoVariantString,
    RaiseEventData,
    SessionContext,
    UAObject,
    UAVariable,
    UAView,
    verifyArguments_ArgumentList
} from "node-opcua-address-space";
import { ICertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { ServerState } from "node-opcua-common";
import { Certificate, exploreCertificate, Nonce, toPem } from "node-opcua-crypto";
import { AttributeIds, DiagnosticInfo, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { dump, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import {
    AsymmetricAlgorithmSecurityHeader,
    computeSignature,
    fromURI,
    getCryptoFactory,
    Message,
    MessageSecurityMode,
    Request,
    Response, SecurityPolicy,
    ServerSecureChannelLayer,
    SignatureData,
    verifySignature
} from "node-opcua-secure-channel";
import {
    BrowseNextRequest,
    BrowseNextResponse,
    BrowseRequest,
    BrowseResponse
} from "node-opcua-service-browse";
import {
    CallMethodRequest,
    CallRequest,
    CallResponse
} from "node-opcua-service-call";
import {
    ApplicationType,
    UserTokenType
} from "node-opcua-service-endpoints";
import {
    HistoryReadRequest,
    HistoryReadResponse, HistoryReadResult, HistoryUpdateResponse
} from "node-opcua-service-history";
import {
    AddNodesResponse,
    AddReferencesResponse,
    DeleteNodesResponse,
    DeleteReferencesResponse
} from "node-opcua-service-node-management";
import {
    QueryFirstResponse,
    QueryNextResponse
} from "node-opcua-service-query";
import {
    ReadRequest,
    ReadResponse,
    ReadValueId,
    TimestampsToReturn
} from "node-opcua-service-read";
import {
    RegisterNodesRequest,
    RegisterNodesResponse,
    UnregisterNodesRequest,
    UnregisterNodesResponse
} from "node-opcua-service-register-node";
import {
    ActivateSessionRequest,
    ActivateSessionResponse,
    AnonymousIdentityToken,
    CloseSessionRequest,
    CloseSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-service-session";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionResponse,
    MonitoredItemModifyResult,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    SetMonitoringModeRequest,
    SetMonitoringModeResponse,
    SetPublishingModeRequest,
    SetPublishingModeResponse,
    TransferSubscriptionsRequest,
    TransferSubscriptionsResponse
} from "node-opcua-service-subscription";
import {
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse
} from "node-opcua-service-translate-browse-path";
import { WriteRequest, WriteResponse } from "node-opcua-service-write";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    ApplicationDescriptionOptions, BrowseResult,
    BuildInfo,
    CallMethodResultOptions,
    CancelResponse,
    EndpointDescription, MonitoredItemModifyRequest,
    MonitoringMode,
    UserIdentityToken, UserTokenPolicy
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { OPCUABaseServer, OPCUABaseServerOptions } from "./base_server";
import { Factory } from "./factory";
import { IRegisterServerManager } from "./I_register_server_manager";
import { MonitoredItem } from "./monitored_item";
import { RegisterServerManager } from "./register_server_manager";
import { RegisterServerManagerHidden } from "./register_server_manager_hidden";
import { RegisterServerManagerMDNSONLY } from "./register_server_manager_mdns_only";
import { ServerCapabilitiesOptions } from "./server_capabilities";
import { OPCUAServerEndPoint } from "./server_end_point";
import { ServerEngine } from "./server_engine";
import { ServerSession } from "./server_session";
import { Subscription } from "./server_subscription";

declare type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export type ValidUserFunc = (this: ServerSession, username: string, password: string) => boolean;
export type ValidUserAsyncFunc = (
    this: ServerSession,
    username: string,
    password: string,
    callback: (err: Error | null, isAuthorized?: boolean) => void) => void;
export type GetUserRoleFunc = (username: string) => string;

export interface UserManagerOptions extends IUserManager {
    /** synchronous function to check the credentials - can be overruled by isValidUserAsync */
    isValidUser?: ValidUserFunc;
    /** asynchronous function to check if the credentials - overrules isValidUser */
    isValidUserAsync?: ValidUserAsyncFunc;
    /**  synchronous function to return the role of the given user */
    getUserRole?: GetUserRoleFunc;
}

// tslint:disable-next-line:no-var-requires
const package_info = require("../package.json");
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = errorLog;

const default_maxAllowedSessionNumber = 10;
const default_maxConnectionsPerEndpoint = 10;

function g_sendError(
    channel: ServerSecureChannelLayer,
    message: Message,
    ResponseClass: any,
    statusCode: StatusCode
): void {
    const response = new ResponseClass({
        responseHeader: { serviceResult: statusCode }
    });
    return channel.send_response("MSG", response, message);
}

const default_build_info = {
    manufacturerName: "Node-OPCUA : MIT Licence ( see http://node-opcua.github.io/)",
    productName: "NODEOPCUA-SERVER",
    productUri: null, // << should be same as default_server_info.productUri?
    softwareVersion: package_info.version
    // xx buildDate: fs.statSync(package_json_file).mtime
};

const minSessionTimeout = 100; // 100 milliseconds
const defaultSessionTimeout = 1000 * 30; // 30 seconds
const maxSessionTimeout = 1000 * 60 * 50; // 50 minutes

function _adjust_session_timeout(sessionTimeout: number) {
    let revisedSessionTimeout = sessionTimeout || defaultSessionTimeout;
    revisedSessionTimeout = Math.min(revisedSessionTimeout, maxSessionTimeout);
    revisedSessionTimeout = Math.max(revisedSessionTimeout, minSessionTimeout);
    return revisedSessionTimeout;
}

function channel_has_session(channel: ServerSecureChannelLayer, session: ServerSession): boolean {
    if (session.channel === channel) {
        assert(channel.sessionTokens.hasOwnProperty(session.authenticationToken.toString()));
        return true;
    }
    return false;
}

function moveSessionToChannel(
    session: ServerSession,
    channel: ServerSecureChannelLayer
) {

    debugLog("moveSessionToChannel sessionId",
        session.nodeId, " channelId=", channel.channelId);
    if (session.publishEngine) {
        session.publishEngine.cancelPendingPublishRequestBeforeChannelChange();
    }

    session._detach_channel();
    session._attach_channel(channel);

    assert(session.channel!.channelId === channel.channelId);

}

function _attempt_to_close_some_old_unactivated_session(
    server: OPCUAServer
) {
    const session = server.engine!.getOldestUnactivatedSession();
    if (session) {
        server.engine!.closeSession(session.authenticationToken, false, "Forcing");
    }
}

function getRequiredEndpointInfo(endpoint: EndpointDescription) {
    assert(endpoint instanceof EndpointDescription);
    // It is recommended that Servers only include the endpointUrl, securityMode,
    // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
    // other parameters set to null. Only the recommended parameters shall be verified by
    // the client.

    const e = new EndpointDescription({
        endpointUrl: endpoint.endpointUrl,
        securityLevel: endpoint.securityLevel,
        securityMode: endpoint.securityMode,
        securityPolicyUri: endpoint.securityPolicyUri,
        transportProfileUri: endpoint.transportProfileUri,
        userIdentityTokens: endpoint.userIdentityTokens
    });
    // reduce even further by explicitly setting unwanted members to null
    (e as any).server = null;
    (e as any).serverCertificate = null;
    return e;
}

// serverUri  String This value is only specified if the EndpointDescription has a gatewayServerUri.
//            This value is the applicationUri from the EndpointDescription which is the applicationUri for the
//            underlying Server. The type EndpointDescription is defined in 7.10.

function _serverEndpointsForCreateSessionResponse(
    server: OPCUAServer,
    serverUri?: string
) {

    serverUri = ""; // unused then

    // The Server shall return a set of EndpointDescriptions available for the serverUri specified in the request.
    // It is recommended that Servers only include the endpointUrl, securityMode,
    // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all other parameters
    // set to null. Only the recommended parameters shall be verified by the client.
    return server._get_endpoints()
        // xx .filter(onlyforUri.bind(null,serverUri)
        .map(getRequiredEndpointInfo);
}

function adjustSecurityPolicy(
    channel: ServerSecureChannelLayer,
    userTokenPolicy_securityPolicyUri: SecurityPolicy
): SecurityPolicy {
    // check that userIdentityToken
    let securityPolicy = fromURI(userTokenPolicy_securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = fromURI((channel.clientSecurityHeader! as AsymmetricAlgorithmSecurityHeader).securityPolicyUri);
        assert(securityPolicy !== SecurityPolicy.Invalid);
    }
    return securityPolicy;
}

function findUserTokenByPolicy(
    endpoint_description: EndpointDescription,
    policyId: SecurityPolicy | string
): UserTokenPolicy | null {
    assert(endpoint_description instanceof EndpointDescription);
    const r = _.filter(endpoint_description.userIdentityTokens!, (userIdentity: UserTokenPolicy) => {
        assert(userIdentity.tokenType !== undefined);
        return userIdentity.policyId === policyId;
    });
    return r.length === 0 ? null : r[0];
}

function findUserTokenPolicy(
    endpoint_description: EndpointDescription,
    userTokenType: UserTokenType
): UserTokenPolicy | null {
    assert(endpoint_description instanceof EndpointDescription);
    const r = _.filter(endpoint_description.userIdentityTokens!, (userIdentity: UserTokenPolicy) => {
        assert(userIdentity.tokenType !== undefined);
        return userIdentity.tokenType === userTokenType;
    });
    return r.length === 0 ? null : r[0];
}

function createAnonymousIdentityToken(
    endpoint_desc: EndpointDescription
) {
    assert(endpoint_desc instanceof EndpointDescription);
    const userTokenPolicy = findUserTokenPolicy(endpoint_desc, UserTokenType.Anonymous);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({ policyId: userTokenPolicy.policyId });
}

function sameIdentityToken(token1: UserIdentityToken, token2: UserIdentityToken): boolean {

    if (token1 instanceof UserNameIdentityToken) {
        if (!(token2 instanceof UserNameIdentityToken)) {
            return false;
        }
        if (token1.userName !== token2.userName) {
            return false;
        }
        if (token1.password.toString("hex") !== token2.password.toString("hex")) {
            return false;
        }
    } else if (token1 instanceof AnonymousIdentityToken) {

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

function thumbprint(certificate?: Certificate): string {
    return certificate ? certificate.toString("base64") : "";
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
function monitoredItem_read_and_record_value(
    self: MonitoredItem,
    context: SessionContext | null,
    oldValue: DataValue,
    node: UAVariable,
    itemToMonitor: any,
    callback: (err: Error | null, dataValue?: DataValue) => void
) {

    assert(self instanceof MonitoredItem);
    assert(oldValue instanceof DataValue);
    assert(itemToMonitor.attributeId === AttributeIds.Value);

    const dataValue = node.readAttribute(
        context, itemToMonitor.attributeId, itemToMonitor.indexRange, itemToMonitor.dataEncoding);

    callback(null, dataValue);
}

/*== private
 * @method monitoredItem_read_and_record_value_async
 * this method applies to Variable Values attribute
 * @param self
 * @param oldValue
 * @param node
 * @param itemToMonitor
 * @private
 */
function monitoredItem_read_and_record_value_async(
    self: MonitoredItem,
    context: SessionContext,
    oldValue: DataValue,
    node: UAVariable,
    itemToMonitor: any,
    callback: (err: Error | null, dataValue?: DataValue) => void
) {

    assert(context instanceof SessionContext);
    assert(itemToMonitor.attributeId === AttributeIds.Value);
    assert(self instanceof MonitoredItem);
    assert(oldValue instanceof DataValue);
    // do it asynchronously ( this is only valid for value attributes )
    assert(itemToMonitor.attributeId === AttributeIds.Value);

    node.readValueAsync(context, (err: Error | null, dataValue?: DataValue) => {
        callback(err, dataValue);
    });
}

function build_scanning_node_function(
    context: SessionContext,
    addressSpace: AddressSpace,
    monitoredItem: MonitoredItem,
    itemToMonitor: any
):
    (
        dataValue: DataValue,
        callback: (err: Error | null, dataValue?: DataValue) => void
    ) => void {

    assert(context instanceof SessionContext);
    assert(itemToMonitor instanceof ReadValueId);

    const node = addressSpace.findNode(itemToMonitor.nodeId) as UAVariable;

    /* istanbul ignore next */
    if (!node) {

        errorLog(" INVALID NODE ID  , ", itemToMonitor.nodeId.toString());
        dump(itemToMonitor);
        return (oldData: DataValue, callback: (err: Error | null, dataValue?: DataValue) => void) => {
            callback(null, new DataValue({
                statusCode: StatusCodes.BadNodeIdUnknown,
                value: { dataType: DataType.Null, value: 0 }
            }));
        };
    }

    ///// !!monitoredItem.setNode(node);

    if (itemToMonitor.attributeId === AttributeIds.Value) {

        const monitoredItem_read_and_record_value_func =
            (itemToMonitor.attributeId === AttributeIds.Value && _.isFunction(node.readValueAsync)) ?
                monitoredItem_read_and_record_value_async :
                monitoredItem_read_and_record_value;

        return function func(
            this: MonitoredItem,
            oldDataValue: DataValue,
            callback: (err: Error | null, dataValue?: DataValue) => void
        ) {
            assert(this instanceof MonitoredItem);
            assert(oldDataValue instanceof DataValue);
            assert(_.isFunction(callback));
            monitoredItem_read_and_record_value_func(
                this, context, oldDataValue, node, itemToMonitor, callback);
        };

    } else {
        // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
        // The filter is not used for these  Attributes. Any change in value for these  Attributes
        // causes a  Notification  to be  generated.

        // only record value when it has changed
        return function func(
            this: MonitoredItem,
            oldDataValue: DataValue,
            callback: (err: Error | null, dataValue?: DataValue) => void
        ) {

            const self = this;
            assert(self instanceof MonitoredItem);
            assert(oldDataValue instanceof DataValue);
            assert(_.isFunction(callback));
            const newDataValue = node.readAttribute(null, itemToMonitor.attributeId);
            callback(null, newDataValue);
        };
    }
}

function prepareMonitoredItem(
    context: SessionContext,
    addressSpace: AddressSpace,
    monitoredItem: MonitoredItem
) {
    const itemToMonitor = monitoredItem.itemToMonitor;
    const readNodeFunc = build_scanning_node_function(context, addressSpace, monitoredItem, itemToMonitor);
    monitoredItem.samplingFunc = readNodeFunc;
}

function isMonitoringModeValid(monitoringMode: MonitoringMode): boolean {
    assert(MonitoringMode.Invalid !== undefined);
    return monitoringMode !== MonitoringMode.Invalid &&
        monitoringMode <= MonitoringMode.Reporting;
}

/**
 * @method registerServer
 * @async
 * @param discoveryServerEndpointUrl
 * @param isOnline
 * @param outer_callback
 */
function _registerServer(
    this: OPCUAServer,
    discoveryServerEndpointUrl: string,
    isOnline: boolean,
    outer_callback: (err?: Error) => void
) {

    assert(typeof discoveryServerEndpointUrl === "string");
    assert(_.isBoolean(isOnline));
    const self = this;
    if (!self.registerServerManager) {
        throw new Error("Internal Error");
    }
    self.registerServerManager.discoveryServerEndpointUrl = discoveryServerEndpointUrl;
    if (isOnline) {
        self.registerServerManager.start(outer_callback);
    } else {
        self.registerServerManager.stop(outer_callback);
    }
}

function _installRegisterServerManager(self: OPCUAServer) {
    assert(self instanceof OPCUAServer);
    assert(!self.registerServerManager);

    /* istanbul ignore next */
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
        /* istanbul ignore next */
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
        debugLog("serverRegistrationPending");
        self.emit("serverRegistrationPending");
    });
    self.registerServerManager.on("serverRegistered", () => {
        /**
         * emitted when the server is successfully registered to the LDS
         * @event serverRegistered
         */
        debugLog("serverRegistered");
        self.emit("serverRegistered");
    });
    self.registerServerManager.on("serverRegistrationRenewed", () => {
        /**
         * emitted when the server has successfully renewed its registration to the LDS
         * @event serverRegistrationRenewed
         */
        debugLog("serverRegistrationRenewed");
        self.emit("serverRegistrationRenewed");
    });

    self.registerServerManager.on("serverUnregistered", () => {
        debugLog("serverUnregistered");
        /**
         * emitted when the server is successfully unregistered to the LDS
         * ( for instance during shutdown)
         * @event serverUnregistered
         */
        self.emit("serverUnregistered");
    });
}

export enum RegisterServerMethod {
    HIDDEN = 1, // the server doesn't expose itself to the external world
    MDNS = 2,   // the server publish itself to the mDNS Multicast network directly
    LDS = 3 // the server registers itself to the LDS or LDS-ME (Local Discovery Server)
}

export interface OPCUAServerEndpointOptions {

    /**
     * the TCP port to listen to.
     * @default 26543
     */
    port?: number;
    /**
     * the possible security policies that the server will expose
     * @default  [SecurityPolicy.None, SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256Sha256]
     */
    securityPolicies?: SecurityPolicy[];
    /**
     * the possible security mode that the server will expose
     * @default [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]
     */
    securityModes?: MessageSecurityMode[];
    /**
     * tells if the server default endpoints should allow anonymous connection.
     * @default true
     */
    allowAnonymous?: boolean;

    /** alternate hostname  or IP to use */
    alternateHostname?: string | string[];

    /**
     *  true, if discovery service on unsecure channel shall be disabled
     */
    disableDiscovery?: boolean;

}

export interface OPCUAServerOptions extends OPCUABaseServerOptions, OPCUAServerEndpointOptions {

    alternateEndpoints?: OPCUAServerEndpointOptions[];

    /**
     * the server certificate full path filename
     *
     * the certificate should be in PEM format
     */
    certificateFile?: string;
    /**
     * the server private key full path filename
     *
     * This file should contains the private key that has been used to generate
     * the server certificate file.
     *
     * the private key should be in PEM format
     *
     */
    privateKeyFile?: string;

    /**
     * the default secure token life time in ms.
     */
    defaultSecureTokenLifetime?: number;
    /**
     * the HEL/ACK transaction timeout in ms.
     *
     * Use a large value ( i.e 15000 ms) for slow connections or embedded devices.
     * @default 10000
     */
    timeout?: number;

    /**
     * the maximum number of simultaneous sessions allowed.
     * @default 10
     */
    maxAllowedSessionNumber?: number;

    /**
     * the maximum number authorized simultaneous connections per endpoint
     * @default 10
     */
    maxConnectionsPerEndpoint?: number;

    /**
     * the nodeset.xml file(s) to load
     *
     * node-opcua comes with pre-installed node-set files that can be used
     *
     * example:
     *
     * ``` javascript
     *
     * ```
     */
    nodeset_filename?: string[] | string;

    /**
     * the server Info
     *
     * this object contains the value that will populate the
     * Root/ObjectS/Server/ServerInfo OPCUA object in the address space.
     */
    serverInfo?: ApplicationDescriptionOptions;
    /*{
            applicationUri?: string;
            productUri?: string;
            applicationName?: LocalizedTextLike | string;
            gatewayServerUri?: string | null;
            discoveryProfileUri?: string | null;
            discoveryUrls?: string[];

        };
    */
    buildInfo?: {
        productName?: string;
        productUri?: string | null, // << should be same as default_server_info.productUri?
        manufacturerName?: string,
        softwareVersion?: string,
        buildNumber?: string;
        buildDate?: Date;
    };

    /**
     *  an object that implements user authentication methods
     */
    userManager?: UserManagerOptions;

    /** resource Path is a string added at the end of the url such as "/UA/Server" */
    resourcePath?: string;

    /**
     *
     */
    serverCapabilities?: ServerCapabilitiesOptions;
    /**
     * if server shall raise AuditingEvent
     * @default true
     */
    isAuditing?: boolean;

    /**
     * strategy used by the server to declare itself to a discovery server
     *
     * - HIDDEN: the server doesn't expose itself to the external world
     * - MDNS: the server publish itself to the mDNS Multicast network directly
     * - LDS: the server registers itself to the LDS or LDS-ME (Local Discovery Server)
     *
     *  @default  RegisterServerMethod.HIDDEN - by default the server
     *            will not register itself to the local discovery server
     *
     */
    registerServerMethod?: RegisterServerMethod;
    /**
     *
     * @default "opc.tcp://localhost:4840"]
     */
    discoveryServerEndpointUrl?: string;
    /**
     *
     *  supported server capabilities for the Mutlicast (mDNS)
     *  @default ["NA"]
     *  the possible values are any of node-opcua-discovery.serverCapabilities)
     *
     */
    capabilitiesForMDNS?: string[];

    /**
     * user Certificate Manager
     * this certificate manager holds the X509 certificates used
     * by client that uses X509 certificate token to impersonate a user
     */
    userCertificateManager?: OPCUACertificateManager;
    /**
     * Server Certificate Manager
     *
     * this certificate manager will be used by the server to access
     * and store certificates from the connecting clients
     */
    serverCertificateManager?: OPCUACertificateManager;

}

export interface OPCUAServer {
    /**
     *
     */
    engine: ServerEngine;
    /**
     *
     */
    registerServerMethod: RegisterServerMethod;
    /**
     *
     */
    discoveryServerEndpointUrl: string;
    /**
     *
     */
    registerServerManager?: IRegisterServerManager;
    /**
     *
     */
    capabilitiesForMDNS: string[];
    /**
     *
     */
    userCertificateManager: OPCUACertificateManager;

}

/**
 *
 */
export class OPCUAServer extends OPCUABaseServer {

    /**
     * total number of bytes written  by the server since startup
     */
    public get bytesWritten(): number {
        return this.endpoints.reduce((accumulated: number, endpoint: OPCUAServerEndPoint) => {
            return accumulated + endpoint.bytesWritten;
        }, 0);
    }

    /**
     * total number of bytes read  by the server since startup
     */
    public get bytesRead(): number {
        return this.endpoints.reduce((accumulated: number, endpoint: OPCUAServerEndPoint) => {
            return accumulated + endpoint.bytesRead;
        }, 0);
    }

    /**
     * Number of transactions processed by the server since startup
     */
    public get transactionsCount(): number {
        return this.endpoints.reduce((accumulated: number, endpoint: OPCUAServerEndPoint) => {
            return accumulated + endpoint.transactionsCount;
        }, 0);
    }

    /**
     * The server build info
     */
    public get buildInfo(): BuildInfo {
        return this.engine.buildInfo;
    }

    /**
     * the number of connected channel on all existing end points
     */
    public get currentChannelCount(): number {
        // TODO : move to base
        const self = this;
        return self.endpoints.reduce((currentValue: number, endPoint: OPCUAServerEndPoint) => {
            return currentValue + endPoint.currentChannelCount;
        }, 0);
    }

    /**
     * The number of active subscriptions from all sessions
     */
    public get currentSubscriptionCount(): number {
        return this.engine ? this.engine.currentSubscriptionCount : 0;
    }

    /**
     * the number of session activation requests that have been rejected
     */
    public get rejectedSessionCount(): number {
        return this.engine ? this.engine.rejectedSessionCount : 0;
    }

    /**
     * the number of request that have been rejected
     */
    public get rejectedRequestsCount(): number {
        return this.engine ? this.engine.rejectedRequestsCount : 0;
    }

    /**
     * the number of sessions that have been aborted
     */
    public get sessionAbortCount(): number {
        return this.engine ? this.engine.sessionAbortCount : 0;
    }

    /**
     * the publishing interval count
     */
    public get publishingIntervalCount(): number {
        return this.engine ? this.engine.publishingIntervalCount : 0;
    }

    /**
     * the number of sessions currently active
     */
    public get currentSessionCount(): number {
        return this.engine ? this.engine.currentSessionCount : 0;
    }

    /**
     * true if the server has been initialized
     *
     */
    public get initialized(): boolean {
        return this.engine && this.engine.addressSpace !== null;
    }

    /**
     * is the server auditing ?
     */
    public get isAuditing(): boolean {
        return this.engine ? this.engine.isAuditing : false;
    }

    public static registry = new ObjectRegistry();
    public static fallbackSessionName = "Client didn't provide a meaningful sessionName ...";
    /**
     * the maximum number of subscription that can be created per server
     */
    public static MAX_SUBSCRIPTION = 50;

    /**
     * the maximum number of concurrent sessions allowed on the server
     */
    public maxAllowedSessionNumber: number;
    /**
     * the maximum number for concurrent connection per end point
     */
    public maxConnectionsPerEndpoint: number;

    /**
     * false if anonymouse connection are not allowed
     */
    public allowAnonymous: boolean = false;

    /**
     * the user manager
     */
    public userManager: UserManagerOptions;

    private objectFactory?: Factory;
    private nonce: Nonce;
    private protocolVersion: number = 0;
    private _delayInit?: () => void;

    constructor(options?: OPCUAServerOptions) {

        super(options);

        options = options || {};

        this.options = options;

        /**
         * @property maxAllowedSessionNumber
         */
        this.maxAllowedSessionNumber = options.maxAllowedSessionNumber || default_maxAllowedSessionNumber;
        /**
         * @property maxConnectionsPerEndpoint
         */
        this.maxConnectionsPerEndpoint = options.maxConnectionsPerEndpoint || default_maxConnectionsPerEndpoint;

        // build Info
        let buildInfo = _.clone(default_build_info) as BuildInfo;
        buildInfo = _.extend(buildInfo, options.buildInfo);

        // repair product name
        buildInfo.productUri = buildInfo.productUri || this.serverInfo.productUri;
        this.serverInfo.productUri = this.serverInfo.productUri || buildInfo.productUri;

        this.userManager = options.userManager || {};
        if (!_.isFunction(this.userManager.isValidUser)) {
            this.userManager.isValidUser = (/*userName,password*/) => {
                return false;
            };
        }

        this.nonce = this.makeServerNonce();

        this.protocolVersion = 0;

        options.allowAnonymous = (options.allowAnonymous === undefined) ? true : !!options.allowAnonymous;
        /**
         * @property allowAnonymous
         */
        this.allowAnonymous = options.allowAnonymous;

        this.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl || "opc.tcp://%FQDN%:4840";
        assert(typeof this.discoveryServerEndpointUrl === "string");

        this.serverInfo.applicationType = ApplicationType.Server;
        this.capabilitiesForMDNS = options.capabilitiesForMDNS || ["NA"];
        this.registerServerMethod = options.registerServerMethod || RegisterServerMethod.HIDDEN;
        _installRegisterServerManager(this);

        if (!options.userCertificateManager) {
            this.userCertificateManager = new OPCUACertificateManager({
                name: "UserPKI"
            });
        } else {
            this.userCertificateManager = options.userCertificateManager;
        }

        // note: we need to delay initialization of endpoint as certain resources
        // such as %FQDN% might not be ready yet at this stage
        this._delayInit = () => {

            /* istanbul ignore next */
            if (!options) {
                throw new Error("Internal Error");
            }
            // to check => this.serverInfo.applicationName = this.serverInfo.productName || buildInfo.productName;

            // note: applicationUri is handled in a special way
            this.engine = new ServerEngine({
                applicationUri: () => this.serverInfo.applicationUri!,
                buildInfo,
                isAuditing: options.isAuditing,
                serverCapabilities: options.serverCapabilities
            });
            this.objectFactory = new Factory(this.engine);

            const endpointDefinitions = options.alternateEndpoints || [];

            endpointDefinitions.push({
                port: options.port || 26543,

                allowAnonymous: options.allowAnonymous,
                alternateHostname: options.alternateHostname,
                disableDiscovery: options.disableDiscovery,
                securityModes: options.securityModes,
                securityPolicies: options.securityPolicies
            });

            // todo  should self.serverInfo.productUri  match self.engine.buildInfo.productUri ?

            const createEndpoint = (port1: number, options1: OPCUAServerOptions): OPCUAServerEndPoint => {
                // add the tcp/ip endpoint with no security
                const endPoint = new OPCUAServerEndPoint({

                    port: port1,

                    certificateManager: this.serverCertificateManager,

                    certificateChain: this.getCertificateChain(),
                    privateKey: this.getPrivateKey(),

                    defaultSecureTokenLifetime: options1.defaultSecureTokenLifetime || 600000,
                    timeout: options1.timeout || 3 * 60 * 1000,

                    maxConnections: this.maxConnectionsPerEndpoint,
                    objectFactory: this.objectFactory,
                    serverInfo: this.serverInfo
                });
                return endPoint;
            };

            function createEndpointDescriptions(options2: OPCUAServerEndpointOptions): OPCUAServerEndPoint {

                /* istanbul ignore next */
                if (!options) {
                    throw new Error("internal error");
                }

                /* istanbul ignore next */
                if (!options2.hasOwnProperty("port") || !_.isFinite(options2.port!)) {
                    throw new Error("expecting a valid port");
                }

                const port = options2.port! + 0;

                const endPoint = createEndpoint(port, options);

                options2.alternateHostname = options2.alternateHostname || [];
                const alternateHostname = (options2.alternateHostname instanceof Array) ? options2.alternateHostname : [options2.alternateHostname];
                const allowAnonymous = (options2.allowAnonymous === undefined) ? true : !!options2.allowAnonymous;

                endPoint.addStandardEndpointDescriptions({
                    allowAnonymous,
                    securityModes: options2.securityModes,
                    securityPolicies: options2.securityPolicies,

                    alternateHostname,

                    disableDiscovery: !!options2.disableDiscovery,
                    // xx                hostname,
                    resourcePath: options.resourcePath || ""
                });
                return endPoint;
            }

            for (const eee of endpointDefinitions) {

                const endPoint = createEndpointDescriptions(eee);
                this.endpoints.push(endPoint);
                endPoint.on("message", (message: Message, channel: ServerSecureChannelLayer) => {
                    this.on_request(message, channel);
                });

                endPoint.on("error", (err: Error) => {
                    errorLog("OPCUAServer endpoint error", err);
                    // set serverState to ServerState.Failed;
                    this.engine.setServerState(ServerState.Failed);
                    this.shutdown(() => {
                        /* empty */
                    });
                });
            }
        };

    }

    /**
     * Initialize the server by installing default node set.
     *
     * and instruct the server to listen to its endpoints.
     *
     * ```javascript
     * const server = new OPCUAServer();
     * await server.initialize();
     *
     * // default server namespace is now initialized
     * // it is a good time to create life instance objects
     * const namespace = server.engine.addressSpace.getOwnNamespace();
     * namespace.addObject({
     *     browseName: "SomeObject",
     *     organizedBy: server.engine.addressSpace.rootFolder.objects
     * });
     *
     * // the addressSpace is now complete
     * // let's now start listening to clients
     * await server.start();
     * ```
     */
    public initialize(): Promise<void>;
    public initialize(done: () => void): void;
    public initialize(...args: [any?, ...any[]]): any {

        const done = args[0] as () => void;

        assert(!this.initialized, "server is already initialized"); // already initialized ?

        callbackify(extractFullyQualifiedDomainName)((err?: Error) => {

            /* istanbul ignore else */
            if (this._delayInit) {
                this._delayInit();
                this._delayInit = undefined;
            }

            OPCUAServer.registry.register(this);

            this.engine.initialize(this.options, () => {

                setImmediate(() => {
                    this.emit("post_initialize");
                    done();
                });
            });
        });
    }

    /**
     * Initiate the server by starting all its endpoints
     * @async
     */
    public start(): Promise<void>;
    public start(done: () => void): void;
    public start(...args: [any?, ...any[]]): any {
        const done = args[0] as () => void;
        const self = this;
        const tasks: any[] = [];

        tasks.push(callbackify(extractFullyQualifiedDomainName));

        if (!self.initialized) {
            tasks.push((callback: (err?: Error) => void) => {
                self.initialize(callback);
            });
        }
        tasks.push((callback: (err?: Error) => void) => {
            OPCUABaseServer.prototype.start.call(self, (err?: Error | null) => {
                if (err) {
                    self.shutdown((/*err2*/err2?: Error) => {
                        callback(err);
                    });
                } else {
                    // we start the registration process asynchronously
                    // as we want to make server immediately available
                    self.registerServerManager!.start(() => {
                        /* empty */
                    });

                    setImmediate(callback);
                }
            });
        });

        async.series(tasks, done);

    }

    /**
     * shutdown all server endpoints
     * @method shutdown
     * @async
     * @param  timeout the timeout (in ms) before the server is actually shutdown
     *
     * @example
     *
     * ```javascript
     *    // shutdown immediately
     *    server.shutdown(function(err) {
     *    });
     * ```
     * ```ts
     *   // in typescript with async/await
     *   await server.shutdown();
     * ```
     * ```javascript
     *    // shutdown within 10 seconds
     *    server.shutdown(10000,function(err) {
     *    });
     *   ```
     */
    public shutdown(timeout?: number): Promise<void>;
    public shutdown(callback: (err?: Error) => void): void;
    public shutdown(timeout: number, callback: (err?: Error) => void): void;
    public shutdown(...args: [any?, ...any[]]): any {

        const timeout = (args.length === 1) ? 1000 : args[0] as number;
        const callback = (args.length === 1 ? args[0] : args[1]) as (err?: Error) => void;
        assert(_.isFunction(callback));
        debugLog("OPCUAServer#shutdown (timeout = ", timeout, ")");

        /* istanbul ignore next */
        if (!this.engine) {
            return callback();
        }
        assert(this.engine);
        if (!this.engine.serverStatus) {
            // server may have been shot down already  , or may have fail to start !!
            const err = new Error("OPCUAServer#shutdown failure ! server doesn't seems to be started yet");
            return callback(err);
        }
        this.engine.setServerState(ServerState.Shutdown);

        debugLog("OPCUServer is now unregistering itself from  the discovery server " + this.buildInfo);
        this.registerServerManager!.stop((err?: Error) => {
            debugLog("OPCUServer unregistered from discovery server", err);
            setTimeout(() => {
                this.engine.shutdown();

                debugLog("OPCUAServer#shutdown: started");
                OPCUABaseServer.prototype.shutdown.call(this, (err1?: Error) => {
                    debugLog("OPCUAServer#shutdown: completed");

                    this.dispose();
                    callback(err1);
                });
            }, timeout);
        });

    }

    public dispose() {

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

        /* istanbul ignore next */
        if (this.engine) {
            this.engine.dispose();
        }
    }

    public raiseEvent(eventType: any, options: any): void {

        /* istanbul ignore next */
        if (!this.engine.addressSpace) {
            errorLog("addressSpace missing");
            return;
        }

        const server = this.engine.addressSpace.findNode("Server") as UAObject;

        /* istanbul ignore next */
        if (!server) {
            // xx throw new Error("OPCUAServer#raiseEvent : cannot find Server object");
            return;
        }

        let eventTypeNode = eventType;
        if (typeof (eventType) === "string") {
            eventTypeNode = this.engine.addressSpace.findEventType(eventType);
        }

        /* istanbul ignore else */
        if (eventTypeNode) {
            return server.raiseEvent(eventTypeNode, options);
        } else {
            console.warn(" cannot find event type ", eventType);
        }
    }

    /**
     * create and register a new session
     * @internal
     */
    protected createSession(options: any): ServerSession {
        /* istanbul ignore next */
        if (!this.engine) {
            throw new Error("Internal Error");
        }
        return this.engine.createSession(options);
    }

    /**
     * retrieve a session by authentication token
     * @internal
     */
    protected getSession(
        authenticationToken: NodeId,
        activeOnly?: boolean
    ): ServerSession | null {
        return this.engine ? this.engine.getSession(authenticationToken, activeOnly) : null;
    }

    /**
     *
     * @param channel
     * @param clientCertificate
     * @param clientNonce
     * @internal
     */
    protected computeServerSignature(
        channel: ServerSecureChannelLayer,
        clientCertificate: Certificate,
        clientNonce: Nonce
    ): SignatureData | undefined {
        return computeSignature(
            clientCertificate, clientNonce,
            this.getPrivateKey(),
            channel.messageBuilder.securityPolicy);
    }

    /**
     *
     * @param session
     * @param channel
     * @param clientSignature
     * @internal
     */
    protected verifyClientSignature(
        session: ServerSession,
        channel: ServerSecureChannelLayer,
        clientSignature: SignatureData
    ): boolean {

        const clientCertificate = channel.receiverCertificate!;
        const securityPolicy = channel.messageBuilder.securityPolicy;
        const serverCertificateChain = this.getCertificateChain();

        const result = verifySignature(
            serverCertificateChain,
            session.nonce!,
            clientSignature,
            clientCertificate,
            securityPolicy);

        return result;
    }

    protected isValidUserNameIdentityToken(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userTokenPolicy: any,
        userIdentityToken: UserNameIdentityToken,
        userTokenSignature: any,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ) {

        assert(userIdentityToken instanceof UserNameIdentityToken);

        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);
        if (securityPolicy === SecurityPolicy.None) {
            return callback(null, StatusCodes.Good);
        }
        const cryptoFactory = getCryptoFactory(securityPolicy);

        /* istanbul ignore next */
        if (!cryptoFactory) {
            return callback(null, StatusCodes.BadSecurityPolicyRejected);
        }

        /* istanbul ignore next */
        if (userIdentityToken.encryptionAlgorithm !== cryptoFactory.asymmetricEncryptionAlgorithm) {
            errorLog("invalid encryptionAlgorithm");
            errorLog("userTokenPolicy", userTokenPolicy.toString());
            errorLog("userTokenPolicy", userIdentityToken.toString());
            return callback(null, StatusCodes.BadIdentityTokenInvalid);
        }
        const userName = userIdentityToken.userName;
        const password = userIdentityToken.password;
        if (!userName || !password) {
            return callback(null, StatusCodes.BadIdentityTokenInvalid);
        }
        return callback(null, StatusCodes.Good);
    }

    protected isValidX509IdentityToken(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userTokenPolicy: any,
        userIdentityToken: X509IdentityToken,
        userTokenSignature: any,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ) {

        assert(userIdentityToken instanceof X509IdentityToken);
        assert(callback instanceof Function);

        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);

        const cryptoFactory = getCryptoFactory(securityPolicy);
        /* istanbul ignore next */
        if (!cryptoFactory) {
            return callback(null, StatusCodes.BadSecurityPolicyRejected);
        }

        if (!userTokenSignature || !userTokenSignature.signature) {
            return callback(null, StatusCodes.BadUserSignatureInvalid);
        }

        if (userIdentityToken.policyId !== userTokenPolicy.policyId) {
            errorLog("invalid encryptionAlgorithm");
            errorLog("userTokenPolicy", userTokenPolicy.toString());
            errorLog("userTokenPolicy", userIdentityToken.toString());
            return callback(null, StatusCodes.BadSecurityPolicyRejected);
        }
        const certificate = userIdentityToken.certificateData/* as Certificate*/;
        const nonce = session.nonce!;
        const serverCertificate = this.getCertificate();

        assert(serverCertificate instanceof Buffer);
        assert(certificate instanceof Buffer, "expecting certificate to be a Buffer");
        assert(nonce instanceof Buffer, "expecting nonce to be a Buffer");
        assert(userTokenSignature.signature instanceof Buffer, "expecting userTokenSignature to be a Buffer");

        // verify proof of possession by checking certificate signature & server nonce correctness
        if (!verifySignature(serverCertificate, nonce, userTokenSignature, certificate, securityPolicy)) {
            return callback(null, StatusCodes.BadUserSignatureInvalid);
        }

        // verify if certificate is Valid
        this.userCertificateManager!.checkCertificate(certificate, (err, certificateStatus) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (StatusCodes.Good !== certificateStatus) {
                assert(certificateStatus instanceof StatusCode);
                return callback(null, certificateStatus);
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
    protected userNameIdentityTokenAuthenticateUser(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userTokenPolicy: any,
        userIdentityToken: UserNameIdentityToken,
        callback: (err: Error | null, isAuthorized?: boolean) => void
    ): void {

        assert(userIdentityToken instanceof UserNameIdentityToken);
        // assert(this.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken));

        const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);

        const userName = userIdentityToken.userName!;
        let password: any = userIdentityToken.password;

        // decrypt password if necessary
        if (securityPolicy === SecurityPolicy.None) {
            password = password.toString();
        } else {
            const serverPrivateKey = this.getPrivateKey();

            const serverNonce = session.nonce!;
            assert(serverNonce instanceof Buffer);

            const cryptoFactory = getCryptoFactory(securityPolicy);
            /* istanbul ignore next */
            if (!cryptoFactory) {
                return callback(new Error(" Unsupported security Policy"));
            }
            const buff = cryptoFactory.asymmetricDecrypt(password, serverPrivateKey);
            const length = buff.readUInt32LE(0) - serverNonce.length;
            password = buff.slice(4, 4 + length).toString("utf-8");
        }

        if (_.isFunction(this.userManager.isValidUserAsync)) {
            this.userManager.isValidUserAsync.call(session, userName, password, callback);
        } else {
            const authorized = this.userManager.isValidUser!.call(session, userName, password);
            async.setImmediate(() => callback(null, authorized));
        }
    }

    /**
     * @internal
     */
    protected isValidUserIdentityToken(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userIdentityToken: UserIdentityToken,
        userTokenSignature: any,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void {

        assert(callback instanceof Function);
        /* istanbul ignore next */
        if (!userIdentityToken) {
            throw new Error("Invalid token");
        }

        const endpoint_desc = channel.endpoint!;
        assert(endpoint_desc instanceof EndpointDescription);

        const userTokenPolicy = findUserTokenByPolicy(endpoint_desc, userIdentityToken.policyId!);
        if (!userTokenPolicy) {
            // cannot find token with this policyId
            return callback(null, StatusCodes.BadIdentityTokenInvalid);
        }
        //
        if (userIdentityToken instanceof UserNameIdentityToken) {
            return this.isValidUserNameIdentityToken(
                channel, session, userTokenPolicy, userIdentityToken, userTokenSignature, callback);
        }
        if (userIdentityToken instanceof X509IdentityToken) {
            return this.isValidX509IdentityToken(
                channel, session, userTokenPolicy, userIdentityToken, userTokenSignature, callback);
        }

        return callback(null, StatusCodes.Good);
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
    protected isUserAuthorized(
        channel: ServerSecureChannelLayer,
        session: ServerSession,
        userIdentityToken: UserIdentityToken,
        callback: (err: Error | null, isAuthorized?: boolean) => void
    ) {

        assert(userIdentityToken);
        assert(_.isFunction(callback));

        const endpoint_desc = channel.endpoint!;
        assert(endpoint_desc instanceof EndpointDescription);

        const userTokenPolicy = findUserTokenByPolicy(endpoint_desc, userIdentityToken.policyId!);
        assert(userTokenPolicy);
        // find if a userToken exists
        if (userIdentityToken instanceof UserNameIdentityToken) {
            return this.userNameIdentityTokenAuthenticateUser(
                channel, session, userTokenPolicy, userIdentityToken, callback);
        }
        async.setImmediate(callback.bind(null, null, true));
    }

    protected makeServerNonce(): Nonce {
        return crypto.randomBytes(32);
    }

    // session services
    protected _on_CreateSessionRequest(message: any, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request;
        assert(request instanceof CreateSessionRequest);

        function rejectConnection(statusCode: StatusCode): void {

            server.engine._rejectedSessionCount += 1;

            const response1 = new CreateSessionResponse({
                responseHeader: { serviceResult: statusCode }
            });
            channel.send_response("MSG", response1, message);
            // and close !
        }

        // From OPCUA V1.03 Part 4 5.6.2 CreateSession
        // A Server application should limit the number of Sessions. To protect against misbehaving Clients and denial
        // of service attacks, the Server shall close the oldest Session that is not activated before reaching the
        // maximum number of supported Sessions
        if (server.currentSessionCount >= server.maxAllowedSessionNumber) {
            _attempt_to_close_some_old_unactivated_session(server);
        }

        // check if session count hasn't reach the maximum allowed sessions
        if (server.currentSessionCount >= server.maxAllowedSessionNumber) {
            return rejectConnection(StatusCodes.BadTooManySessions);
        }

        // Release 1.03 OPC Unified Architecture, Part 4 page 24 - CreateSession Parameters
        // client should prove a sessionName
        // Session name is a Human readable string that identifies the Session. The Server makes this name and the
        // sessionId visible in its AddressSpace for diagnostic purposes. The Client should provide a name that is
        // unique for the instance of the Client.
        // If this parameter is not specified the Server shall assign a value.

        if (utils.isNullOrUndefined(request.sessionName)) {
            // see also #198
            // let's the server assign a sessionName for this lazy client.

            debugLog("assigning OPCUAServer.fallbackSessionName because client's sessionName is null ",
                OPCUAServer.fallbackSessionName);

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

                errorLog(chalk.red("SERVER with secure connection: Missing or invalid client Nonce "),
                    request.clientNonce && request.clientNonce.toString("hex"));

                return rejectConnection(StatusCodes.BadNonceInvalid);
            }
        }

        function validate_applicationUri(
            applicationUri: string,
            clientCertificate: Certificate
        ): boolean {

            // if session is insecure there is no need to check certificate information
            if (channel.securityMode === MessageSecurityMode.None) {
                return true; // assume correct
            }
            if (!clientCertificate || clientCertificate.length === 0) {
                return true; // can't check
            }
            const e = exploreCertificate(clientCertificate);
            const applicationUriFromCert = e.tbsCertificate.extensions!.subjectAltName.uniformResourceIdentifier[0];

            /* istanbul ignore next */
            if (applicationUriFromCert !== applicationUri) {
                errorLog("BadCertificateUriInvalid!");
                errorLog("applicationUri           = ", applicationUri);
                errorLog("applicationUriFromCert   = ", applicationUriFromCert);
            }

            return applicationUriFromCert === applicationUri;
        }

        // check application spoofing
        // check if applicationUri in createSessionRequest matches applicationUri in client Certificate
        if (!validate_applicationUri(request.clientDescription.applicationUri, request.clientCertificate)) {
            return rejectConnection(StatusCodes.BadCertificateUriInvalid);
        }

        function validate_security_endpoint(channel1: ServerSecureChannelLayer): StatusCode {

            let endpoints = server._get_endpoints();

            // ignore restricted endpoints
            endpoints = endpoints.filter((endpoint: EndpointDescription) => {
                return !(endpoint as any).restricted;
            });

            const endpoints_matching_security_mode = endpoints.filter((e: EndpointDescription) => {
                return e.securityMode === channel1.securityMode;
            });

            if (endpoints_matching_security_mode.length === 0) {
                return StatusCodes.BadSecurityModeRejected;
            }
            const endpoints_matching_security_policy =
                endpoints_matching_security_mode.filter((e: EndpointDescription) => {
                    return e.securityPolicyUri === channel1.securityHeader!.securityPolicyUri;
                });

            if (endpoints_matching_security_policy.length === 0) {
                return StatusCodes.BadSecurityPolicyRejected;
            }
            return StatusCodes.Good;
        }

        const errStatus = validate_security_endpoint(channel);
        if (errStatus !== StatusCodes.Good) {
            return rejectConnection(errStatus);
        }

        // endpointUrl String The network address that the Client used to access the Session Endpoint.
        //             The HostName portion of the URL should be one of the HostNames for the application that are
        //             specified in the Server’s ApplicationInstanceCertificate (see 7.2). The Server shall raise an
        //             AuditUrlMismatchEventType event if the URL does not match the Server’s HostNames.
        //             AuditUrlMismatchEventType event type is defined in Part 5.
        //             The Server uses this information for diagnostics and to determine the set of
        //             EndpointDescriptions to return in the response.
        function validate_endpointUri() {
            // ToDo: check endpointUrl validity and emit an AuditUrlMismatchEventType event if not
        }

        validate_endpointUri();

        // see Release 1.02  27  OPC Unified Architecture, Part 4
        const session = server.createSession({
            clientDescription: request.clientDescription,
            sessionTimeout: revisedSessionTimeout
        });

        assert(session);
        assert(session.sessionTimeout === revisedSessionTimeout);

        session.clientDescription = request.clientDescription;
        session.sessionName = request.sessionName;

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
        session.nonce = server.makeServerNonce();
        session.channelId = channel.channelId;

        session._attach_channel(channel);

        const serverCertificateChain = server.getCertificateChain();

        const hasEncryption = true;
        // If the securityPolicyUri is None and none of the UserTokenPolicies requires encryption
        if (session.channel!.securityMode === MessageSecurityMode.None) {
            // ToDo: Check that none of our unsecure endpoint has a a UserTokenPolicy that require encryption
            // and set hasEncryption = false under this condition
        }

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
            serverCertificate: hasEncryption ? serverCertificateChain : undefined,

            // The endpoints provided by the server.
            // The Server shall return a set of EndpointDescriptions available for the serverUri
            // specified in the request.[...]
            // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery
            // Endpoint to fetch the EndpointDescriptions.
            // It is recommended that Servers only include the endpointUrl, securityMode,
            // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
            // other parameters set to null. Only the recommended parameters shall be verified by
            // the client.
            serverEndpoints: _serverEndpointsForCreateSessionResponse(server, request.serverUri),

            // This parameter is deprecated and the array shall be empty.
            serverSoftwareCertificates: null,

            // This is a signature generated with the private key associated with the
            // serverCertificate. This parameter is calculated by appending the clientNonce to the
            // clientCertificate and signing the resulting sequence of bytes.
            // The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm specified in the
            // SecurityPolicy for the Endpoint.
            // The SignatureData type is defined in 7.30.
            serverSignature: server.computeServerSignature(channel, request.clientCertificate, request.clientNonce),

            // The maximum message size accepted by the server
            // The Client Communication Stack should return a Bad_RequestTooLarge error to the
            // application if a request message exceeds this limit.
            // The value zero indicates that this parameter is not used.
            maxRequestMessageSize: 0x4000000

        });

        server.emit("create_session", session);

        session.on("session_closed", (session1: ServerSession, deleteSubscriptions: boolean, reason: string) => {

            assert(_.isString(reason));
            if (server.isAuditing) {

                assert(reason === "Timeout" ||
                    reason === "Terminated" ||
                    reason === "CloseSession" ||
                    reason === "Forcing");
                const sourceName = "Session/" + reason;

                server.raiseEvent("AuditSessionEventType", {
                    /* part 5 -  6.4.3 AuditEventType */
                    actionTimeStamp: { dataType: "DateTime", value: new Date() },
                    status: { dataType: "Boolean", value: true },

                    serverId: { dataType: "String", value: "" },

                    // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                    clientAuditEntryId: { dataType: "String", value: "" },

                    // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
                    // obtained from the UserIdentityToken passed in the ActivateSession call.
                    clientUserId: { dataType: "String", value: "" },

                    sourceName: { dataType: "String", value: sourceName },

                    /* part 5 - 6.4.7 AuditSessionEventType */
                    sessionId: { dataType: "NodeId", value: session1.nodeId }

                });
            }

            server.emit("session_closed", session1, deleteSubscriptions);

        });

        if (server.isAuditing) {

            // ------------------------------------------------------------------------------------------------------
            server.raiseEvent("AuditCreateSessionEventType", {

                /* part 5 -  6.4.3 AuditEventType */
                actionTimeStamp: { dataType: "DateTime", value: new Date() },
                status: { dataType: "Boolean", value: true },

                serverId: { dataType: "String", value: "" },

                // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                clientAuditEntryId: { dataType: "String", value: "" },

                // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
                // obtained from the UserIdentityToken passed in the ActivateSession call.
                clientUserId: { dataType: "String", value: "" },

                sourceName: { dataType: "String", value: "Session/CreateSession" },

                /* part 5 - 6.4.7 AuditSessionEventType */
                sessionId: { dataType: "NodeId", value: session.nodeId },

                /* part 5 - 6.4.8 AuditCreateSessionEventType */
                // SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same
                // identifier in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
                // AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
                // (AuditChannelEventType and its subtypes
                secureChannelId: { dataType: "String", value: session.channel!.channelId!.toString() },

                // Duration
                revisedSessionTimeout: { dataType: "Duration", value: session.sessionTimeout },

                // clientCertificate
                clientCertificate: { dataType: "ByteString", value: session.channel!.clientCertificate },

                // clientCertificateThumbprint
                clientCertificateThumbprint: {
                    dataType: "ByteString",
                    value: thumbprint(session.channel!.clientCertificate!)
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
     * @method _on_ActivateSessionRequest
     * @private
     *
     *
     */
    protected _on_ActivateSessionRequest(message: any, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request;
        assert(request instanceof ActivateSessionRequest);

        // get session from authenticationToken
        const authenticationToken = request.requestHeader.authenticationToken;

        const session = server.getSession(authenticationToken);

        function rejectConnection(statusCode: StatusCode): void {
            server.engine._rejectedSessionCount += 1;
            const response1 = new ActivateSessionResponse({ responseHeader: { serviceResult: statusCode } });

            channel.send_response("MSG", response1, message);
            // and close !
        }

        let response;

        /* istanbul ignore next */
        if (!session) {
            // this may happen when the server has been restarted and a client tries to reconnect, thinking
            // that the previous session may still be active
            debugLog(chalk.yellow.bold(" Bad Session in  _on_ActivateSessionRequest"),
                authenticationToken.toString());

            return rejectConnection(StatusCodes.BadSessionIdInvalid);
        }

        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
        // if the  SecureChannel  is not same as the one associated with the  CreateSession  request.
        if (session.status === "new") {
            // xx if (channel.session_nonce !== session.nonce) {
            if (!channel_has_session(channel, session)) {
                // it looks like session activation is being using a channel that is not the
                // one that have been used to create the session
                errorLog(" channel.sessionTokens === " + Object.keys(channel.sessionTokens).join(" "));
                return rejectConnection(StatusCodes.BadSessionNotActivated);
            }
        }

        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // ... Subsequent calls to  ActivateSession  may be associated with different  SecureChannels.  If this is the
        // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
        // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.

        if (session.status === "active") {

            if (session.channel!.channelId !== channel.channelId) {
                warningLog(" Session ", session.sessionName, " is being transferred from channel",
                    chalk.cyan(session.channel!.channelId!.toString()),
                    " to channel ", chalk.cyan(channel.channelId!.toString()));

                // session is being reassigned to a new Channel,
                // we shall verify that the certificate used to create the Session is the same as the current
                // channel certificate.
                const old_channel_cert_thumbprint = thumbprint(session.channel!.clientCertificate!);
                const new_channel_cert_thumbprint = thumbprint(channel.clientCertificate!);

                if (old_channel_cert_thumbprint !== new_channel_cert_thumbprint) {
                    return rejectConnection(StatusCodes.BadNoValidCertificates); // not sure about this code !
                }

                // ... In addition the Server shall verify that the  Client  supplied a  UserIdentityToken  that is
                // identical to the token currently associated with the  Session reassign session to new channel.
                if (!sameIdentityToken(session.userIdentityToken!, request.userIdentityToken)) {
                    return rejectConnection(StatusCodes.BadIdentityChangeNotSupported); // not sure about this code !
                }
            }

            moveSessionToChannel(session, channel);

        } else if (session.status === "screwed") {
            // session has been used before being activated => this should be detected and session should be dismissed.
            return rejectConnection(StatusCodes.BadSessionClosed);
        } else if (session.status === "closed") {
            warningLog(
                chalk.yellow.bold(" Bad Session Closed in  _on_ActivateSessionRequest"),
                authenticationToken.value.toString("hex"));
            return rejectConnection(StatusCodes.BadSessionClosed);
        }

        // verify clientSignature provided by the client
        if (!server.verifyClientSignature(session, channel, request.clientSignature)) {
            return rejectConnection(StatusCodes.BadApplicationSignatureInvalid);
        }

        // userIdentityToken may be missing , assume anonymous access then
        request.userIdentityToken = request.userIdentityToken || createAnonymousIdentityToken(channel.endpoint!);

        // check request.userIdentityToken is correct ( expected type and correctly formed)
        server.isValidUserIdentityToken(
            channel, session, request.userIdentityToken, request.userTokenSignature,
            (err: Error | null, statusCode?: StatusCode) => {

                if (statusCode !== StatusCodes.Good) {
                    /* istanbul ignore next */
                    if (!(statusCode && statusCode instanceof StatusCode)) {
                        const a = 23;
                    }
                    assert(statusCode && statusCode instanceof StatusCode, "expecting statusCode");
                    return rejectConnection(statusCode!);
                }
                session.userIdentityToken = request.userIdentityToken;

                // check if user access is granted
                server.isUserAuthorized(channel, session, request.userIdentityToken,
                    (err1: Error | null, authorized?: boolean) => {

                        /* istanbul ignore next */
                        if (err1) {
                            return rejectConnection(StatusCodes.BadInternalError);
                        }

                        if (!authorized) {
                            return rejectConnection(StatusCodes.BadUserAccessDenied);
                        } else {
                            // extract : OPC UA part 4 - 5.6.3
                            // Once used, a serverNonce cannot be used again. For that reason, the Server returns a new
                            // serverNonce each time the ActivateSession Service is called.
                            session.nonce = server.makeServerNonce();

                            session.status = "active";

                            response = new ActivateSessionResponse({ serverNonce: session.nonce });
                            channel.send_response("MSG", response, message);

                            const userIdentityTokenPasswordRemoved = (userIdentityToken: any) => {
                                const a = userIdentityToken.clone();
                                // remove password
                                a.password = "*************";
                                return a;
                            };

                            // send OPCUA Event Notification
                            // see part 5 : 6.4.3 AuditEventType
                            //              6.4.7 AuditSessionEventType
                            //              6.4.10 AuditActivateSessionEventType
                            assert(session.nodeId); // sessionId
                            // xx assert(session.channel.clientCertificate instanceof Buffer);
                            assert(session.sessionTimeout > 0);

                            if (server.isAuditing) {
                                server.raiseEvent("AuditActivateSessionEventType", {

                                    /* part 5 -  6.4.3 AuditEventType */
                                    actionTimeStamp: { dataType: "DateTime", value: new Date() },
                                    status: { dataType: "Boolean", value: true },

                                    serverId: { dataType: "String", value: "" },

                                    // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                                    clientAuditEntryId: { dataType: "String", value: "" },

                                    // The ClientUserId identifies the user of the client requesting an action.
                                    // The ClientUserId can be obtained from the UserIdentityToken passed in the
                                    // ActivateSession call.
                                    clientUserId: { dataType: "String", value: "cc" },

                                    sourceName: { dataType: "String", value: "Session/ActivateSession" },

                                    /* part 5 - 6.4.7 AuditSessionEventType */
                                    sessionId: { dataType: "NodeId", value: session.nodeId },

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
                                        value: userIdentityTokenPasswordRemoved(session.userIdentityToken)
                                    },

                                    // SecureChannelId shall uniquely identify the SecureChannel. The application shall
                                    // use the same identifier in all AuditEvents related to the Session Service Set
                                    // (AuditCreateSessionEventType, AuditActivateSessionEventType and their subtypes) and
                                    // the SecureChannel Service Set (AuditChannelEventType and its subtypes).
                                    secureChannelId: { dataType: "String", value: session.channel!.channelId!.toString() }
                                });
                            }
                        }
                    });
            });

    }

    protected prepare(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request;

        // --- check that session is correct
        const authenticationToken = request.requestHeader.authenticationToken;
        const session = server.getSession(authenticationToken, /*activeOnly*/true);
        message.session = session;
        if (!session) {
            message.session_statusCode = StatusCodes.BadSessionIdInvalid;
            return;
        }

        // --- check that provided session matches session attached to channel
        if (channel.channelId !== session.channelId) {
            if (!(request instanceof ActivateSessionRequest)) {
                errorLog(chalk.red.bgWhite("ERROR: channel.channelId !== session.channelId"),
                    channel.channelId, session.channelId);
            }
            message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;

        } else if (channel_has_session(channel, session)) {
            message.session_statusCode = StatusCodes.Good;
        } else {
            // session ma y have been moved to a different channel
            message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;
        }
    }

    /**
     * ensure that action is performed on a valid session object,
     * @method _apply_on_SessionObject
     * @param ResponseClass the constructor of the response Class
     * @param message
     * @param channel
     * @param action_to_perform
     * @param action_to_perform.session {ServerSession}
     * @param action_to_perform.sendResponse
     * @param action_to_perform.sendResponse.response
     * @param action_to_perform.sendError
     * @param action_to_perform.sendError.statusCode
     * @param action_to_perform.sendError.diagnostics
     *
     * @private
     */
    protected _apply_on_SessionObject(
        ResponseClass: any,
        message: any,
        channel: ServerSecureChannelLayer,
        action_to_perform: any
    ) {

        assert(_.isFunction(action_to_perform));

        function sendResponse(response1: any) {
            assert(response1 instanceof ResponseClass);
            if (message.session) {
                const counterName = ResponseClass.name.replace("Response", "");
                message.session.incrementRequestTotalCounter(counterName);
            }
            return channel.send_response("MSG", response1, message);
        }

        function sendError(statusCode: StatusCode) {

            if (message.session) {
                message.session.incrementRequestErrorCounter(ResponseClass.name.replace("Response", ""));
            }
            return g_sendError(channel, message, ResponseClass, statusCode);
        }

        let response;
        /* istanbul ignore next */
        if (!message.session || message.session_statusCode !== StatusCodes.Good) {
            const errMessage = "INVALID SESSION  !! ";
            response = new ResponseClass({ responseHeader: { serviceResult: message.session_statusCode } });
            debugLog(chalk.red.bold(errMessage),
                chalk.yellow(message.session_statusCode.toString()), response.constructor.name);
            return sendResponse(response);
        }

        assert(message.session_statusCode === StatusCodes.Good);

        // OPC UA Specification 1.02 part 4 page 26
        // When a  Session  is terminated, all outstanding requests on the  Session  are aborted and
        // Bad_SessionClosed  StatusCodes  are returned to the  Client. In addition,   the  Server  deletes the entry
        // for the  Client  from its  SessionDiagnostics Array  Variable  and notifies any other  Clients  who were
        // subscribed to this entry.
        if (message.session.status === "closed") {
            // note : use StatusCodes.BadSessionClosed , for pending message for this session
            return sendError(StatusCodes.BadSessionIdInvalid);
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
        assert(_.isFunction(message.session.keepAlive));
        message.session.keepAlive();

        message.session.incrementTotalRequestCount();

        action_to_perform(message.session, sendResponse, sendError);
    }

    /**
     * @method _apply_on_Subscription
     * @param ResponseClass
     * @param message
     * @param channel
     * @param action_to_perform
     * @private
     */
    protected _apply_on_Subscription(
        ResponseClass: any,
        message: any,
        channel: ServerSecureChannelLayer,
        action_to_perform: any
    ) {

        assert(_.isFunction(action_to_perform));
        const request = message.request;
        assert(request.hasOwnProperty("subscriptionId"));

        this._apply_on_SessionObject(ResponseClass, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {
                const subscription = session.getSubscription(request.subscriptionId);
                if (!subscription) {
                    return sendError(StatusCodes.BadSubscriptionIdInvalid);
                }
                subscription.resetLifeTimeAndKeepAliveCounters();
                action_to_perform(session, subscription, sendResponse, sendError);
            });
    }

    /**
     * @method _apply_on_SubscriptionIds
     * @param ResponseClass
     * @param message
     * @param channel
     * @param action_to_perform
     * @private
     */
    protected _apply_on_SubscriptionIds(
        ResponseClass: any,
        message: any,
        channel: ServerSecureChannelLayer,
        action_to_perform: any
    ) {

        assert(_.isFunction(action_to_perform));
        const request = message.request;
        assert(request.hasOwnProperty("subscriptionIds"));

        this._apply_on_SessionObject(ResponseClass, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                const subscriptionIds = request.subscriptionIds;

                if (!request.subscriptionIds || request.subscriptionIds.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                const results = subscriptionIds.map((subscriptionId: number) => {
                    return action_to_perform(session, subscriptionId);
                });

                const response = new ResponseClass({
                    results
                });
                sendResponse(response);

            });
    }

    /**
     * @method _apply_on_Subscriptions
     * @param ResponseClass
     * @param message
     * @param channel
     * @param action_to_perform
     * @private
     */
    protected _apply_on_Subscriptions(
        ResponseClass: any,
        message: any,
        channel: ServerSecureChannelLayer,
        action_to_perform: (session: ServerSession, subscription: Subscription) => void
    ) {

        this._apply_on_SubscriptionIds(ResponseClass, message, channel,
            (session: ServerSession, subscriptionId: number) => {
                /* istanbul ignore next */
                if (subscriptionId <= 0) {
                    return StatusCodes.BadSubscriptionIdInvalid;
                }
                const subscription = session.getSubscription(subscriptionId);
                if (!subscription) {
                    return StatusCodes.BadSubscriptionIdInvalid;
                }
                return action_to_perform(session, subscription);
            });
    }

    /**
     * @method _on_CloseSessionRequest
     * @param message
     * @param channel
     * @private
     */
    protected _on_CloseSessionRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;

        const request = message.request as CloseSessionRequest;
        assert(request instanceof CloseSessionRequest);

        let response;

        message.session_statusCode = StatusCodes.Good;

        function sendError(statusCode: StatusCode) {
            return g_sendError(channel, message, CloseSessionResponse, statusCode);
        }

        function sendResponse(response1: CloseSessionResponse) {
            channel.send_response("MSG", response1, message);
        }

        // do not use _apply_on_SessionObject
        // this._apply_on_SessionObject(CloseSessionResponse, message, channel, function (session) {
        // });

        const session = message.session;
        if (!session) {
            return sendError(StatusCodes.BadSessionIdInvalid);
        }

        // session has been created but not activated !
        const wasNotActivated = (session.status === "new");

        server.engine.closeSession(
            request.requestHeader.authenticationToken,
            request.deleteSubscriptions, "CloseSession");

        if (wasNotActivated) {
            return sendError(StatusCodes.BadSessionNotActivated);
        }
        response = new CloseSessionResponse({});
        sendResponse(response);
    }

    // browse services
    /**
     * @method _on_BrowseRequest
     * @param message
     * @param channel
     * @private
     */
    protected _on_BrowseRequest(message: Message, channel: ServerSecureChannelLayer) {
        const server = this;
        const request = message.request as BrowseRequest;
        assert(request instanceof BrowseRequest);
        const diagnostic: any = {};

        this._apply_on_SessionObject(BrowseResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response: BrowseResponse;
                // test view
                if (request.view && !request.view.viewId.isEmpty()) {
                    let theView: UAView | null = server.engine!.addressSpace!.findNode(request.view.viewId) as UAView;
                    if (theView && theView.nodeClass !== NodeClass.View) {
                        // Error: theView is not a View
                        diagnostic.localizedText = { text: "Expecting a view here" };
                        theView = null;
                    }
                    if (!theView) {
                        return sendError(StatusCodes.BadViewIdUnknown, diagnostic);
                    }
                }

                if (!request.nodesToBrowse || request.nodesToBrowse.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                if (server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse > 0) {
                    if (request.nodesToBrowse.length > server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                // limit results to requestedMaxReferencesPerNode further so it never exceed a too big number
                const requestedMaxReferencesPerNode = Math.min(9876, request.requestedMaxReferencesPerNode);
                let results: BrowseResult[] = [];
                assert(request.nodesToBrowse[0].schema.name === "BrowseDescription");
                results = server.engine.browse(request.nodesToBrowse);

                assert(results[0].schema.name === "BrowseResult");

                // handle continuation point and requestedMaxReferencesPerNode
                results = results.map((result: BrowseResult) => {
                    assert(!result.continuationPoint);
                    const truncatedResult = session.continuationPointManager.register(
                        requestedMaxReferencesPerNode,
                        result.references || []
                    );
                    assert(truncatedResult.statusCode === StatusCodes.Good);
                    truncatedResult.statusCode = result.statusCode;
                    return new BrowseResult(truncatedResult);
                });

                response = new BrowseResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            });
    }

    /**
     * @method _on_BrowseNextRequest
     * @param message
     * @param channel
     * @private
     */
    protected _on_BrowseNextRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as BrowseNextRequest;
        assert(request instanceof BrowseNextRequest);
        this._apply_on_SessionObject(BrowseNextResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response;

                if (!request.continuationPoints || request.continuationPoints.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                // A Boolean parameter with the following values:

                let results;
                if (request.releaseContinuationPoints) {
                    // releaseContinuationPoints = TRUE
                    //   passed continuationPoints shall be reset to free resources in
                    //   the Server. The continuation points are released and the results
                    //   and diagnosticInfos arrays are empty.
                    results = request.continuationPoints.map((continuationPoint: ContinuationPoint) => {
                        return session.continuationPointManager.cancel(continuationPoint);
                    });

                } else {
                    // let extract data from continuation points

                    // releaseContinuationPoints = FALSE
                    //   passed continuationPoints shall be used to get the next set of
                    //   browse information.
                    results = request.continuationPoints.map((continuationPoint: ContinuationPoint) => {
                        return session.continuationPointManager.getNext(continuationPoint);
                    });
                }

                response = new BrowseNextResponse({
                    diagnosticInfos: undefined,
                    results
                });
                sendResponse(response);
            });
    }

    // read services
    protected _on_ReadRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as ReadRequest;
        assert(request instanceof ReadRequest);

        this._apply_on_SessionObject(ReadResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                const context = new SessionContext({ session, server });

                let response;

                let results = [];

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

                assert(request.nodesToRead[0].schema.name === "ReadValueId");

                // limit size of nodesToRead array to maxNodesPerRead
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
                    if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                // proceed with registered nodes alias resolution
                for (const nodeToRead of request.nodesToRead) {
                    nodeToRead.nodeId = session.resolveRegisteredNode(nodeToRead.nodeId);
                }

                // ask for a refresh of asynchronous variables
                server.engine.refreshValues(request.nodesToRead, (err?: Error | null) => {
                    assert(!err, " error not handled here , fix me");

                    results = server.engine.read(context, request);

                    assert(results[0].schema.name === "DataValue");
                    assert(results.length === request.nodesToRead!.length);

                    response = new ReadResponse({
                        diagnosticInfos: undefined,
                        results: undefined
                    });
                    // set it here for performance
                    response.results = results;
                    assert(response.diagnosticInfos!.length === 0);
                    sendResponse(response);
                });
            });
    }

    // read services
    protected _on_HistoryReadRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as HistoryReadRequest;

        assert(request instanceof HistoryReadRequest);

        this._apply_on_SessionObject(HistoryReadResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response;

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
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
                    if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }
                // todo : handle
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData > 0) {
                    if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents > 0) {
                    if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                const context = new SessionContext({ session, server });

                // ask for a refresh of asynchronous variables
                server.engine.refreshValues(request.nodesToRead, (err?: Error | null) => {

                    assert(!err, " error not handled here , fix me"); // TODO

                    server.engine.historyRead(context, request, (err1: Error | null, results?: HistoryReadResult[]) => {

                        if (err1) {
                            return sendError(StatusCodes.BadInternalError);
                        }
                        if (!results) {
                            return sendError(StatusCodes.BadInternalError);
                        }

                        assert(results[0].schema.name === "HistoryReadResult");
                        assert(results.length === request.nodesToRead!.length);

                        response = new HistoryReadResponse({
                            diagnosticInfos: undefined,
                            results
                        });

                        assert(response.diagnosticInfos!.length === 0);
                        sendResponse(response);
                    });
                });
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
    protected _on_WriteRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as WriteRequest;
        assert(request instanceof WriteRequest);
        assert(!request.nodesToWrite || _.isArray(request.nodesToWrite));

        this._apply_on_SessionObject(WriteResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {
                let response;

                if (!request.nodesToWrite || request.nodesToWrite.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                if (server.engine.serverCapabilities.operationLimits.maxNodesPerWrite > 0) {
                    if (request.nodesToWrite.length > server.engine.serverCapabilities.operationLimits.maxNodesPerWrite) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                // proceed with registered nodes alias resolution
                for (const nodeToWrite of request.nodesToWrite) {
                    nodeToWrite.nodeId = session.resolveRegisteredNode(nodeToWrite.nodeId);
                }

                const context = new SessionContext({ session, server });

                assert(request.nodesToWrite[0].schema.name === "WriteValue");
                server.engine.write(context, request.nodesToWrite, (err: Error | null, results?: StatusCode[]) => {
                    assert(!err);
                    assert(_.isArray(results));
                    assert(results!.length === request.nodesToWrite!.length);
                    response = new WriteResponse({
                        diagnosticInfos: undefined,
                        results
                    });
                    sendResponse(response);
                });
            });
    }

    // subscription services
    protected _on_CreateSubscriptionRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const engine = server.engine;
        const addressSpace = engine.addressSpace!;

        const request = message.request as CreateSubscriptionRequest;
        assert(request instanceof CreateSubscriptionRequest);

        this._apply_on_SessionObject(CreateSubscriptionResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                const context = new SessionContext({ session, server });

                if (session.currentSubscriptionCount >= OPCUAServer.MAX_SUBSCRIPTION) {
                    return sendError(StatusCodes.BadTooManySubscriptions);
                }

                const subscription = session.createSubscription(request);

                subscription.on("monitoredItem", (monitoredItem: MonitoredItem) => {
                    prepareMonitoredItem(context, addressSpace, monitoredItem);
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

    protected _on_DeleteSubscriptionsRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as DeleteSubscriptionsRequest;
        assert(request instanceof DeleteSubscriptionsRequest);
        this._apply_on_SubscriptionIds(DeleteSubscriptionsResponse, message, channel,
            (session: ServerSession, subscriptionId: number) => {

                const subscription = server.engine.findOrphanSubscription(subscriptionId);
                if (subscription) {
                    return server.engine.deleteOrphanSubscription(subscription);
                }

                return session.deleteSubscription(subscriptionId);
            });
    }

    protected _on_TransferSubscriptionsRequest(message: Message, channel: ServerSecureChannelLayer) {

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

        const server = this;
        const engine = server.engine;

        const request = message.request as TransferSubscriptionsRequest;
        assert(request instanceof TransferSubscriptionsRequest);
        this._apply_on_SubscriptionIds(TransferSubscriptionsResponse, message, channel,
            (session: ServerSession, subscriptionId: number) => {
                return engine.transferSubscription(session, subscriptionId, request.sendInitialValues);
            });
    }

    protected _on_CreateMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const engine = server.engine;
        const addressSpace = engine.addressSpace!;

        const request = message.request as CreateMonitoredItemsRequest;
        assert(request instanceof CreateMonitoredItemsRequest);

        this._apply_on_Subscription(CreateMonitoredItemsResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                const timestampsToReturn = request.timestampsToReturn;
                if (timestampsToReturn === TimestampsToReturn.Invalid) {
                    return sendError(StatusCodes.BadTimestampsToReturnInvalid);
                }

                if (!request.itemsToCreate || request.itemsToCreate.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }
                if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                    if (request.itemsToCreate.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                const results = request.itemsToCreate.map(
                    subscription.createMonitoredItem.bind(subscription, addressSpace, timestampsToReturn));

                const response = new CreateMonitoredItemsResponse({
                    responseHeader: { serviceResult: StatusCodes.Good },
                    results
                    // ,diagnosticInfos: []
                });

                sendResponse(response);

            });

    }

    protected _on_ModifySubscriptionRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as ModifySubscriptionRequest;
        assert(request instanceof ModifySubscriptionRequest);

        this._apply_on_Subscription(ModifySubscriptionResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                subscription.modify(request);

                const response = new ModifySubscriptionResponse({
                    revisedLifetimeCount: subscription.lifeTimeCount,
                    revisedMaxKeepAliveCount: subscription.maxKeepAliveCount,
                    revisedPublishingInterval: subscription.publishingInterval
                });

                sendResponse(response);
            });
    }

    protected _on_ModifyMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer) {
        const server = this;
        const request = message.request as ModifyMonitoredItemsRequest;

        assert(request instanceof ModifyMonitoredItemsRequest);
        this._apply_on_Subscription(ModifyMonitoredItemsResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                const timestampsToReturn = request.timestampsToReturn;
                if (timestampsToReturn === TimestampsToReturn.Invalid) {
                    return sendError(StatusCodes.BadTimestampsToReturnInvalid);
                }

                if (!request.itemsToModify || request.itemsToModify.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                /* istanbul ignore next */
                if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                    if (request.itemsToModify.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                const itemsToModify = request.itemsToModify; // MonitoredItemModifyRequest

                function modifyMonitoredItem(item: MonitoredItemModifyRequest) {

                    const monitoredItemId = item.monitoredItemId;
                    const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
                    if (!monitoredItem) {
                        return new MonitoredItemModifyResult({ statusCode: StatusCodes.BadMonitoredItemIdInvalid });
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

    protected _on_PublishRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as PublishRequest;
        assert(request instanceof PublishRequest);

        this._apply_on_SessionObject(PublishResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {
                assert(session);
                assert(session.publishEngine); // server.publishEngine doesn't exists, OPCUAServer has probably shut down already
                session.publishEngine._on_PublishRequest(request, (request1: any, response: any) => {
                    sendResponse(response);
                });
            });
    }

    protected _on_SetPublishingModeRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as SetPublishingModeRequest;
        assert(request instanceof SetPublishingModeRequest);
        const publishingEnabled = request.publishingEnabled;
        this._apply_on_Subscriptions(SetPublishingModeResponse, message, channel,
            (session: ServerSession, subscription: Subscription) => {
                return subscription.setPublishingMode(publishingEnabled);
            });
    }

    protected _on_DeleteMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer) {
        const server = this;
        const request = message.request as DeleteMonitoredItemsRequest;
        assert(request instanceof DeleteMonitoredItemsRequest);

        this._apply_on_Subscription(DeleteMonitoredItemsResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                /* istanbul ignore next */
                if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                /* istanbul ignore next */
                if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                    if (request.monitoredItemIds.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }
                const results = request.monitoredItemIds.map((monitoredItemId: number) => {
                    return subscription.removeMonitoredItem(monitoredItemId);
                });

                const response = new DeleteMonitoredItemsResponse({
                    diagnosticInfos: undefined,
                    results
                });

                sendResponse(response);
            });
    }

    protected _on_RepublishRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as RepublishRequest;
        assert(request instanceof RepublishRequest);

        this._apply_on_Subscription(RepublishResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                // update diagnostic counter
                subscription.subscriptionDiagnostics.republishRequestCount += 1;

                const retransmitSequenceNumber = request.retransmitSequenceNumber;
                const msgSequence = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);

                if (!msgSequence) {
                    return sendError(StatusCodes.BadMessageNotAvailable);
                }
                const response = new RepublishResponse({
                    notificationMessage: msgSequence.notification,
                    responseHeader: {
                        serviceResult: StatusCodes.Good
                    }
                });

                sendResponse(response);
            });
    }

    // Bad_NothingToDo
    // Bad_TooManyOperations
    // Bad_SubscriptionIdInvalid
    // Bad_MonitoringModeInvalid
    protected _on_SetMonitoringModeRequest(message: Message, channel: ServerSecureChannelLayer) {
        const server = this;
        const request = message.request as SetMonitoringModeRequest;
        assert(request instanceof SetMonitoringModeRequest);

        this._apply_on_Subscription(SetMonitoringModeResponse, message, channel,
            (session: ServerSession, subscription: Subscription, sendResponse: any, sendError: any) => {

                /* istanbul ignore next */
                if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                /* istanbul ignore next */
                if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
                    if (request.monitoredItemIds.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
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
                    monitoredItem.setMonitoringMode(monitoringMode);
                    return StatusCodes.Good;
                });

                const response = new SetMonitoringModeResponse({
                    results
                });
                sendResponse(response);
            });

    }

    // _on_TranslateBrowsePathsToNodeIds service
    protected _on_TranslateBrowsePathsToNodeIdsRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as TranslateBrowsePathsToNodeIdsRequest;
        assert(request instanceof TranslateBrowsePathsToNodeIdsRequest);
        const server = this;

        this._apply_on_SessionObject(TranslateBrowsePathsToNodeIdsResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                if (!request.browsePaths || request.browsePaths.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds > 0) {
                    if (request.browsePaths.length > server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                const browsePathsResults = request.browsePaths.map((browsePath) => server.engine.browsePath(browsePath));

                const response = new TranslateBrowsePathsToNodeIdsResponse({
                    diagnosticInfos: null,
                    results: browsePathsResults
                });

                sendResponse(response);

            });

    }

    // Call Service Result Codes
    // Symbolic Id Description
    // Bad_NothingToDo       See Table 165 for the description of this result code.
    // Bad_TooManyOperations See Table 165 for the description of this result code.
    //
    protected _on_CallRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as CallRequest;
        assert(request instanceof CallRequest);

        this._apply_on_SessionObject(CallResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response;

                if (!request.methodsToCall || request.methodsToCall.length === 0) {
                    return sendError(StatusCodes.BadNothingToDo);
                }

                // the MaxNodesPerMethodCall Property indicates the maximum size of the methodsToCall array when
                // a Client calls the Call Service.
                let maxNodesPerMethodCall = server.engine.serverCapabilities.operationLimits.maxNodesPerMethodCall;
                maxNodesPerMethodCall = maxNodesPerMethodCall <= 0 ? 1000 : maxNodesPerMethodCall;
                if (request.methodsToCall.length > maxNodesPerMethodCall) {
                    return sendError(StatusCodes.BadTooManyOperations);
                }

                /* jshint validthis: true */
                const addressSpace = server.engine.addressSpace!;

                async.map(request.methodsToCall, callMethodHelper.bind(null, server, session, addressSpace),
                    (err?: Error | null, results?: Array<CallMethodResultOptions | undefined>) => {

                        /* istanbul ignore next */
                        if (err) {
                            errorLog("ERROR in method Call !! ", err);
                        }
                        assert(_.isArray(results));
                        response = new CallResponse({
                            results: results as CallMethodResultOptions[]
                        });
                        sendResponse(response);
                    });
            });
    }

    protected _on_RegisterNodesRequest(message: Message, channel: ServerSecureChannelLayer) {
        const server = this;
        const request = message.request as RegisterNodesRequest;
        assert(request instanceof RegisterNodesRequest);

        this._apply_on_SessionObject(RegisterNodesResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response;

                if (!request.nodesToRegister || request.nodesToRegister.length === 0) {
                    response = new RegisterNodesResponse({ responseHeader: { serviceResult: StatusCodes.BadNothingToDo } });
                    return sendResponse(response);
                }
                if (server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
                    if (request.nodesToRegister.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
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

                response = new RegisterNodesResponse({
                    registeredNodeIds
                });
                sendResponse(response);
            });
    }

    protected _on_UnregisterNodesRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as UnregisterNodesRequest;
        assert(request instanceof UnregisterNodesRequest);

        this._apply_on_SessionObject(UnregisterNodesResponse, message, channel,
            (session: ServerSession, sendResponse: any, sendError: any) => {

                let response;

                request.nodesToUnregister = request.nodesToUnregister || [];

                if (!request.nodesToUnregister || request.nodesToUnregister.length === 0) {
                    response = new UnregisterNodesResponse({ responseHeader: { serviceResult: StatusCodes.BadNothingToDo } });
                    return sendResponse(response);
                }

                if (server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
                    if (request.nodesToUnregister.length >
                        server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
                        return sendError(StatusCodes.BadTooManyOperations);
                    }
                }

                request.nodesToUnregister.map((nodeId: NodeId) => session.unRegisterNode(nodeId));

                response = new UnregisterNodesResponse({});
                sendResponse(response);
            });
    }

    /* istanbul ignore next */
    protected _on_Cancel(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, CancelResponse, StatusCodes.BadNotImplemented);
    }

    // NodeManagement Service Set Overview
    // This Service Set defines Services to add and delete AddressSpace Nodes and References between them. All added
    // Nodes continue to exist in the AddressSpace even if the Client that created them disconnects from the Server.
    //
    /* istanbul ignore next */
    protected _on_AddNodes(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, AddNodesResponse, StatusCodes.BadNotImplemented);
    }

    /* istanbul ignore next */
    protected _on_AddReferences(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, AddReferencesResponse, StatusCodes.BadNotImplemented);
    }

    /* istanbul ignore next */
    protected _on_DeleteNodes(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, DeleteNodesResponse, StatusCodes.BadNotImplemented);
    }

    /* istanbul ignore next */
    protected _on_DeleteReferences(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, DeleteReferencesResponse, StatusCodes.BadNotImplemented);
    }

    // Query Service
    /* istanbul ignore next */
    protected _on_QueryFirst(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, QueryFirstResponse, StatusCodes.BadNotImplemented);
    }

    /* istanbul ignore next */
    protected _on_QueryNext(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, QueryNextResponse, StatusCodes.BadNotImplemented);
    }

    /* istanbul ignore next */
    protected _on_HistoryUpdate(message: Message, channel: ServerSecureChannelLayer) {
        return g_sendError(channel, message, HistoryUpdateResponse, StatusCodes.BadNotImplemented);
    }

}

export interface RaiseEventAuditEventData extends RaiseEventData {

    actionTimeStamp: PseudoVariantDateTime;
    status: PseudoVariantBoolean;
    serverId: PseudoVariantString;
    /**
     * ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
     */
    clientAuditEntryId: PseudoVariantString;
    /**
     * The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
     * obtained from the UserIdentityToken passed in the ActivateSession call.
     */
    clientUserId: PseudoVariantString;
    sourceName: PseudoVariantString;

}

export interface RaiseEventAuditUpdateMethodEventData extends RaiseEventAuditEventData {
    methodId: PseudoVariantNodeId;
    inputArguments: any;
}

export interface RaiseEventAuditConditionCommentEventData extends RaiseEventAuditUpdateMethodEventData {
    eventId: PseudoVariantByteString;
    comment: PseudoVariantLocalizedText;
}

export interface RaiseEventAuditSessionEventData extends RaiseEventAuditEventData {
    /**
     *  part 5 - 6.4.7 AuditSessionEventType
     */
    sessionId: PseudoVariantNodeId;
}

export interface RaiseEventAuditCreateSessionEventData extends RaiseEventAuditSessionEventData {

    /**
     *  part 5 - 6.4.8 AuditCreateSessionEventType
     *  SecureChannelId shall uniquely identify the SecureChannel.
     *  The application shall use the same identifier in
     *  all AuditEvents related to the Session Service Set (AuditCreateSessionEventType, AuditActivateSessionEventType
     *  and their subtypes) and the SecureChannel Service Set (AuditChannelEventType and its subtype
     */
    secureChannelId: PseudoVariantString;
    revisedSessionTimeout: PseudoVariantDuration;
    clientCertificate: PseudoVariantByteString;
    clientCertificateThumbprint: PseudoVariantByteString;
}

export interface RaiseEventAuditActivateSessionEventData extends RaiseEventAuditSessionEventData {

    /**
     * part 5 - 6.4.10 AuditActivateSessionEventType
     */
    clientSoftwareCertificates: PseudoVariantExtensionObjectArray;
    /**
     * UserIdentityToken reflects the userIdentityToken parameter of the ActivateSession Service call.
     * For Username/Password tokens the password should NOT be included.
     */
    userIdentityToken: PseudoVariantExtensionObject;
    /**
     * SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same identifier
     * in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
     * AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
     * (AuditChannelEventType and its subtypes).
     */
    secureChannelId: PseudoVariantString;

}

// tslint:disable:no-empty-interface
export interface RaiseEventTransitionEventData extends RaiseEventData {
}

export interface OPCUAServer {

    /**
     * @internal
     * @param eventType
     * @param options
     */
    raiseEvent(
        eventType: "AuditSessionEventType", options: RaiseEventAuditSessionEventData): void;

    raiseEvent(
        eventType: "AuditCreateSessionEventType", options: RaiseEventAuditCreateSessionEventData): void;

    raiseEvent(
        eventType: "AuditActivateSessionEventType", options: RaiseEventAuditActivateSessionEventData): void;

    raiseEvent(
        eventType: "AuditCreateSessionEventType", options: RaiseEventData
    ): void;

    raiseEvent(
        eventType: "AuditConditionCommentEventType", options: RaiseEventAuditConditionCommentEventData): void;

    raiseEvent(
        eventType: "TransitionEventType", options: RaiseEventTransitionEventData): void;

}

export interface OPCUAServer extends EventEmitter {
    on(event: "create_session", eventHandler: (session: ServerSession) => void): this;

    on(event: "session_closed", eventHandler: (session: ServerSession, reason: string) => void): this;

    on(event: "post_initialize", eventHandler: () => void): void;

    /**
     * emitted when the server is trying to registered the LDS
     * but when the connection to the lds has failed
     * serverRegistrationPending is sent when the backoff signal of the
     * connection process is raised
     * @event serverRegistrationPending
     */
    on(event: "serverRegistrationPending", eventHandler: () => void): void;

    /**
     * event raised when server  has been successfully registered on the local discovery server
     * @event serverRegistered
     */
    on(event: "serverRegistered", eventHandler: () => void): void;

    /**
     * event raised when server registration has been successfully renewed on the local discovery server
     * @event serverRegistered
     */
    on(event: "serverRegistrationRenewed", eventHandler: () => void): void;

    /**
     * event raised when server  has been successfully unregistered from the local discovery server
     * @event serverUnregistered
     */
    on(event: "serverUnregistered", eventHandler: () => void): void;

    /**
     * event raised after the server has raised an OPCUA event toward a client
     */
    on(event: "event", eventHandler: (eventData: any) => void): void;

    /**
     * event raised when the server received a request from one of its connected client.
     * useful for trace purpose.
     */
    on(event: "request", eventHandler: (request: Request, channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when the server send an response to a request to one of its connected client.
     * useful for trace purpose.
     */
    on(event: "response", eventHandler: (request: Response, channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when a new secure channel is opened
     */
    on(event: "newChannel", eventHandler: (channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when a new secure channel is closed
     */
    on(event: "closeChannel", eventHandler: (channel: ServerSecureChannelLayer) => void): void;

    on(event: string, eventHandler: (...args: [any?, ...any[]]) => void): this;

}

// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
OPCUAServer.prototype.start = thenify.withCallback(OPCUAServer.prototype.start, opts);
OPCUAServer.prototype.initialize = thenify.withCallback(OPCUAServer.prototype.initialize, opts);
OPCUAServer.prototype.shutdown = thenify.withCallback(OPCUAServer.prototype.shutdown, opts);
