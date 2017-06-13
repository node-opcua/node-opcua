// Type definitions for node-opua
// Project: https://github.com/node-opcua/node-opcua
// Definitions by: Etienne Rossignon
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export interface ErrorCallback {
    (err?: Error): void;
}

export interface ResponseCallback<T> {
    (err?: Error| null, response?: T): void;
}
export declare enum MessageSecurityMode {
    INVALID,        // The MessageSecurityMode is invalid
    NONE,           // No security is applied.
    SIGN,           // All messages are signed but not encrypted.
    SIGNANDENCRYPT  // All messages are signed and encrypted.

}
export declare enum SecurityPolicy {
    None,           // "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128,       // "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic128Rsa15,  // "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
    Basic192,       // "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15,  // "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256,       // "http://opcfoundation.org/UA/SecurityPolicy#Basic256",
    Basic256Rsa15,  // "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256  // "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
}
export interface OPCUAClientOptions {

    defaultSecureTokenLiveTime?: number, //default secure token lifetime in ms
    serverCertificate?: any , // =null] {Certificate} the server certificate.
    connectionStrategy?: {
        maxRetry?: number,
        initialDelay?: number,
        maxDelay?: number,
        randomisationFactor?: number
    },
// {MessageSecurityMode} the default security mode.
    securityMode?: any, //  MessageSecurityMode, // [ =  MessageSecurityMode.None]
    securityPolicy?: number|string, // : SecurityPolicy,//  =SecurityPolicy.NONE] {SecurityPolicy} the security mode.
    requestedSessionTimeout?: number, //= 60000]            {Number} the requested session time out in CreateSession
    applicationName?: string ,// ="NodeOPCUA-Client"]        {string} the client application name
    endpoint_must_exist?: boolean, // true] {Boolean} set to false if the client should accept server endpoint mismatch
    keepSessionAlive?: boolean,//=false]{Boolean}
    certificateFile?: string, // "certificates/client_selfsigned_cert_1024.pem"] {String} client certificate pem file.
    privateKeyFile?: string,// "certificates/client_key_1024.pem"] {String} client private key pem file.
    clientName?: string //] {String} a client name string that will be used to generate session names.
}

export declare class OPCUAClientBase {
    /**
     *
     */
    securityMode: MessageSecurityMode;

    /**
     *
     */
    securityPolicy: SecurityPolicy;

    /**
     *
     */
    serverCertificate: Uint8Array| null;

    /**
     *
     * connect the OPC-UA client to a server end point.
     * @param options
     * @param callback
     */
    connect(endpointUrl: string,
            callback: ErrorCallback): void;

    disconnect(callback: ErrorCallback): void;

    performMessageTransaction(request: any,
                              callback: ResponseCallback<any>): void;

}

export interface BrowseResponse {

}

export interface NodeId {

}
type UInt32 = number;

export enum BrowseDirection {
    Forward,
    Inverse,
    Both
}

export interface BrowseDescription {
    nodeId?: NodeId, // The id of the node to browse.
    browseDirection?: BrowseDirection,// The direction of the references to return.
    referenceTypeId?: NodeId,  // The type of references to return.Specifies the NodeId of the ReferenceType to follow. Only instances of this ReferenceType or its subtype are returned.If not specified then all ReferenceTypes are returned and includeSubtypes is ignored.
    includeSubtypes?: boolean, // Includes subtypes of the reference type.
    nodeClassMask?: UInt32,  // A mask indicating which node classes to return. 0 means return all nodes.
    resultMask?: UInt32 // } A mask indicating which fields in the ReferenceDescription should be returned in the results.
}

export type ExpandedNodeId = any;
export type QualifiedName = any;
export type LocalizedText = any;
export type NodeClass = any;

export interface ReferenceDescription {
    referenceTypeId: NodeId,      // The type of references.
    isForward: boolean,           // TRUE if the reference is a forward reference.
    nodeId: ExpandedNodeId,       // The id of the target node.
    browseName: QualifiedName,    // The browse name of the target node.
    displayName: LocalizedText,   // The display name of the target node.
    nodeClass: NodeClass,         // The node class of the target node.
    typeDefinition: ExpandedNodeId// The type definition of the target node.
}

export interface BrowseResult {
    statusCode: any,
    continuationPoint: any,
    references: Array<ReferenceDescription>
}

type CoercibleToBrowseDescription = string | BrowseDescription ;

export declare interface ClientSession {

    browse(nodeToBrowse:CoercibleToBrowseDescription,
           callback: ResponseCallback<BrowseResponse>):void;

    browse(nodeToBrowse: Array<CoercibleToBrowseDescription>,
           callback: ResponseCallback<Array<BrowseResponse> >):void;

    writeSingleNode(path: string, value: Variant, callback: Function): void;
}

export interface UserIdentityInfo {
    userName: string,
    password: string
}

/**
 *  @class OPCUAClient
 *  @extends OPCUAClientBase
 */
export declare class OPCUAClient extends OPCUAClientBase {
    /**
     */
    constructor(options: OPCUAClientOptions);

    createSession(userIdentityInfo: UserIdentityInfo,
                  callback: ResponseCallback<ClientSession>): void;

    createSession(callback: ResponseCallback<ClientSession>): void;

    closeSession(session: ClientSession,
                 deleteSubscriptions: boolean,
                 callback: (err: Error|null) => void): void;

}
//----------------------------------------------------------------------------------------------------------------------

declare type ValidUserFunc = (username:string,password:string) => boolean;
declare type ValidUserAsyncFunc = (username:string,password:string,callback)=>void;

export interface OPCUAServerOptions {
   defaultSecureTokenLifetime? : number, // the default secure token life time in ms.
   timeout? :number,                     // (default:10000)    the HEL/ACK transaction timeout in ms. Use a large value
                                         // ( i.e 15000 ms) for slow connections or embedded devices.
   port?: number,                        //  (default:26543)            the TCP port to listen to.
   maxAllowedSessionNumber?:number,      //(deafult:10) the maximum number of concurrent sessions allowed.

    nodeset_filename?: Array<string>|string, // the nodeset.xml file(s) to load
    serverInfo?: {                       //  the information used in the end point description
        applicationUri?: string,         //  (default "urn:NodeOPCUA-Server")
        productUri?: string,             // = "NodeOPCUA-Server"]{String}
        applicationName?: LocalizedText|string, // "applicationName"}]{LocalizedText}
        gatewayServerUri?: string,
        discoveryProfileUri?: string
        discoveryUrls?: Array<string>
    },
    securityPolicies?:  Array<SecurityPolicy>,      // SecurityPolicy.None,SecurityPolicy.Basic128Rsa15,SecurityPolicy.Basic256]]
    securityModes?:     Array<MessageSecurityMode>, // MessageSecurityMode.NONE,MessageSecurityMode.SIGN,MessageSecurityMode.SIGNANDENCRYPT]]
    allowAnonymous?:    boolean,             // [default = true] tells if the server default endpoints should allow anonymous connection.
    userManager?: {                          // an object that implements user authentication methods
        isValidUser?: ValidUserFunc,          // synchronous function to check the credentials - can be overruled by isValidUserAsync
        isValidUserAsync?: ValidUserAsyncFunc // asynchronous function to check if the credentials - overrules isValidUser

    },
    resourcePath?: string,                    // resource Path is a string added at the end of the url such as "/UA/Server"
    alternateHostname?: string,               // alternate hostname to use
    isAuditing?: boolean                      // (default=true) if server shall raise AuditingEvent
}


export declare enum ServerState {
    Running,
    Failed,
    NoConfiguration,
    Suspended,
    Shutdown,
    Test,
    CommunicationFault,
    Unknown
}

export declare class BrowseName {
    name: string;
    namespace: number;
}

export declare enum DataType {
    Boolean,
    Uint16,
    Uint32,
    Int16,
    Int32,
    Float,
    Double
    // to be continued ...
}

export declare interface AddReferenceOpts {
    referenceType: string|NodeId;
    nodeId:  NodeId|string;
}
export declare class UAReference {

}

export declare class BaseNode {

    browseName : BrowseName;
    addReference(options: AddReferenceOpts): UAReference;

}
export declare class UAView extends BaseNode {

}
export declare class UAVariable extends BaseNode {

}
export declare class UAAnalogItem extends UAVariable {

}

declare interface StatusCode {
    Good,
    BadWaitingForInitialData
    // to be continued
}
export interface VariantOpts {
    dataType: DataType;
    value: any;
}

export declare class Variant implements VariantOpts {
    constructor(options: VariantOpts)
    dataType: DataType;
    value: any;

}
declare interface DataValueOpts {
    value: Variant;
    sourceTimestamp: Date;
    serverTimestamp: Date;
    sourcePicosecond: number;
    serverPicosecond: number;
    statusCode: StatusCode;
}

export declare class DataValue implements DataValueOpts {
    constructor(options: DataValueOpts);
    value: Variant;
    sourceTimestamp: Date;
    serverTimestamp: Date;
    sourcePicosecond: number;
    serverPicosecond: number;
    statusCode: StatusCode;
}

export interface _AddNodeOpts {
    browseName: string;
    organizedBy?: NodeId|BaseNode;
    nodeId?: string|NodeId;
}

export interface AddVariableOpts extends _AddNodeOpts {
    dataType: string|DataType;
    value: {
        get?: ()=>Variant,
        timestamp_get?: ()=>DataValue,
        refreshFunc?: (err:null|Error,dataValue?: DataValue)=>void;
    }
}
export enum EUEngineeringUnit {
    degree_celsius,
    meter,
    // to be continued
}

export interface AddAnalogDataItemOpts extends _AddNodeOpts{
    definition: string; // exemple  "(tempA -25) + tempB",
    valuePrecision: number; // 0.5,
    engineeringUnitsRange: {
        low: number,
        high: number
    },
    instrumentRange: {
        low: number,
        high: number
    },
    engineeringUnits: EUEngineeringUnit
}
export declare class AddressSpace {

    find(node: NodeId|string): BaseNode;

    addVariable(options: AddVariableOpts): UAVariable;

    addAnalogDataItem(options: AddAnalogDataItemOpts): UAAnalogItem;

    addView(options: _AddNodeOpts):   UAView;

}

//xx declare type BuildInfo;
export declare class ServerEngine{
    addressSpace: AddressSpace;
}
export declare class OPCUAServer {
    constructor(options: OPCUAServerOptions);

    bytesWritten: number;
    bytesRead: number;
    transactionsCount: number;
    currentSubscriptionCount: number;
    rejectedSessionCount: number;
    sessionAbortCount: number;
    publishingIntervalCount: number;
    sessionTimeoutCount: number;
    /**
     * the number of connected channel on all existing end points
     */
    currentChannelCount: number;
    buildInfo: any;


    secondsTillShutdown(): number;

    serverName: string;
    serverNameUrn: string;

    engine: ServerEngine;

    setServerState(serverState:ServerState):void;

    start(callback: (error: Error) => void): void;

    shutdown(timeout: number, callback: ResponseCallback<void>): void;

    // "postinitialize" , "session_closed", "create_session"
    on(event: string, eventhandler: () => void): void;
}

export declare class ClientMonitoredItem {
    terminate(callback: Function): void;
    on(event: string, eventhandler: (v:Variant) => void): void;
}

export interface TimestampsToReturn {
    Invalid: -1,
    Source: 0,
    Server: 1,
    Both: 2,
    Neither: 3
}

export declare class read_service {
    static TimestampsToReturn: TimestampsToReturn;
}

export interface ItemToMonitor {
    nodeId: NodeId
    attributeId: AttributeIds
    // TODO: figure out how to represent indexRange (NumericRange) and dataEncoding (unknown)
}

export interface ItemToMonitorRequestedParameters {
    samplingInterval: number
    discardOldest: boolean
    queueSize: number
    // TODO: add filter parameter (extension object)
}

export interface ClientSubscriptionOptions {
    requestedPublishingInterval: number
    requestedLifetimeCount: number
    requestedMaxKeepAliveCount: number
    maxNotificationsPerPublish: number
    publishingEnabled: boolean
    priority: number
}

export declare class ClientSubscription {
    constructor(session: ClientSession, options: ClientSubscriptionOptions);
    monitor(itemToMonitor: ItemToMonitor, requestedParameters: ItemToMonitorRequestedParameters, timestampsToReturn: number, done?: Function): ClientMonitoredItem;
}

export declare enum AttributeIds {
    NodeId = 1,
    NodeClass = 2,
    BrowseName = 3,
    DisplayName = 4,
    Description = 5,
    WriteMask = 6,
    UserWriteMask = 7,
    IsAbstract = 8,
    Symmetric = 9,
    InverseName = 10,
    ContainsNoLoops = 11,
    EventNotifier = 12,
    Value = 13,
    DataType = 14,
    ValueRank = 15,
    ArrayDimensions = 16,
    AccessLevel = 17,
    UserAccessLevel = 18,
    MinimumSamplingInterval = 19,
    Historizing = 20,
    Executable = 21,
    UserExecutable = 22,
    INVALID = 999
}

export declare function resolveNodeId(id: NodeId | string): NodeId;

