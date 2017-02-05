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
    INVALID= 0, // The MessageSecurityMode is invalid
    NONE= 1, // No security is applied.
    SIGN= 2, // All messages are signed but not encrypted.
    SIGNANDENCRYPT= 3  // All messages are signed and encrypted.

}
export declare enum SecurityPolicy {
    None=            "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128=       "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic128Rsa15=  "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
    Basic192=       "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15=  "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256=       "http://opcfoundation.org/UA/SecurityPolicy#Basic256",
    Basic256Rsa15=  "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256= "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
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

