/**
 * @module node-opcua-pseudo-session
 */
import { assert } from "node-opcua-assert";
import { ByteString } from "node-opcua-basic-types";
import { AttributeIds, BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDescriptionOptions, BrowseResult } from "node-opcua-service-browse";
import { Argument, CallMethodRequestOptions, CallMethodResult } from "node-opcua-service-call";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { WriteValueOptions } from "node-opcua-service-write";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { VariableIds } from "node-opcua-constants";
import { UserTokenType, X509IdentityTokenOptions } from "node-opcua-types";

export type BrowseDescriptionLike = string | BrowseDescriptionOptions;
export type CallMethodRequestLike = CallMethodRequestOptions;

export type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export type MethodId = NodeIdLike;

export interface ArgumentDefinition {
    inputArguments: Argument[];
    outputArguments: Argument[];
}
export interface IBasicTransportSettings {
    maxMessageSize: number;
}

// #region Browse
export interface IBasicSessionBrowseAsyncSimple {
    browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
}

export interface IBasicSessionBrowseAsyncMultiple {
    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
}
export interface IBasicSessionBrowseAsync extends IBasicSessionBrowseAsyncSimple, IBasicSessionBrowseAsyncMultiple {
    browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
}

export interface IBasicSessionBrowseCallback {
    browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;
}
export interface IBasicSessionBrowse extends IBasicSessionBrowseAsync, IBasicSessionBrowseCallback {
    browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
    browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;
}
// #endregion

// #region BrowseNext
export interface IBasicSessionBrowseNextAsyncSimple {
    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;
}
export interface IBasicSessionBrowseNextAsyncMultiple {
    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
}
export interface IBasicSessionBrowseNextAsync extends IBasicSessionBrowseNextAsyncMultiple, IBasicSessionBrowseNextAsyncSimple {
    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;
    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
}
export interface IBasicSessionBrowseNextCallback {
    /**
     *
     * @param continuationPoint
     * @param releaseContinuationPoints  a Boolean parameter with the following values:
     *     * `true` passed continuationPoints shall be reset to free resources in
     *      the Server. The continuation points are released and the results
     *      and diagnosticInfos arrays are empty.
     *     * `false` passed continuationPoints shall be used to get the next set of
     *      browse information.
     *
     *   A Client shall always use the continuation point returned by a Browse or
     *    BrowseNext response to free the resources for the continuation point in the
     *    Server. If the Client does not want to get the next set of browse information,
     *    BrowseNext shall be called with this parameter set to `true`.
     *
     */
    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean, callback: ResponseCallback<BrowseResult>): void;

    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean, callback: ResponseCallback<BrowseResult[]>): void;
}
export interface IBasicSessionBrowseNext extends IBasicSessionBrowseNextAsync, IBasicSessionBrowseNextCallback {
    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;
    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean, callback: ResponseCallback<BrowseResult>): void;

    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean, callback: ResponseCallback<BrowseResult[]>): void;
}
// #endregion

// #region Read
export interface IBasicSessionReadAsyncSimple {
    read(nodeToRead: ReadValueIdOptions, maxAge?: number): Promise<DataValue>;
}
export interface IBasicSessionReadAsyncMultiple {
    read(nodesToRead: ReadValueIdOptions[], maxAge?: number): Promise<DataValue[]>;
}

export interface IBasicSessionReadAsync extends IBasicSessionReadAsyncSimple, IBasicSessionReadAsyncMultiple {
    read(nodeToRead: ReadValueIdOptions, maxAge?: number): Promise<DataValue>;
    read(nodesToRead: ReadValueIdOptions[], maxAge?: number): Promise<DataValue[]>;
}
export interface IBasicSessionReadCallback {
    read(nodeToRead: ReadValueIdOptions, maxAge: number, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdOptions[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;
    read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;
}
export interface IBasicSessionRead extends IBasicSessionReadCallback, IBasicSessionReadAsync {
    read(nodeToRead: ReadValueIdOptions, maxAge?: number): Promise<DataValue>;
    read(nodesToRead: ReadValueIdOptions[], maxAge?: number): Promise<DataValue[]>;
    read(nodeToRead: ReadValueIdOptions, maxAge: number, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdOptions[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;
    read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;
}
// #endregion

// #region Write
export interface IBasicSessionWriteAsyncSimple {
    write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
}
export interface IBasicSessionWriteAsyncMultiple {
    write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
}
export interface IBasicSessionWriteAsync extends IBasicSessionWriteAsyncSimple, IBasicSessionWriteAsyncMultiple {
    write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
    write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
}
export interface IBasicSessionWriteCallback {
    write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;
    write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;
}
export interface IBasicSessionWrite extends IBasicSessionWriteCallback, IBasicSessionWriteAsync {
    write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
    write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
    write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;
    write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;
}

// #endregion

// #region Call
export interface IBasicSessionCallAsyncSimple {
    call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
}
export interface IBasicSessionCallAsyncMultiple {
    call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
}
export interface IBasicSessionCallAsync extends IBasicSessionCallAsyncSimple, IBasicSessionCallAsyncMultiple {
    call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
}
export interface IBasicSessionCallCallback {
    call(methodToCall: CallMethodRequestLike, callback: (err: Error | null, result?: CallMethodResult) => void): void;
    call(methodsToCall: CallMethodRequestLike[], callback: (err: Error | null, results?: CallMethodResult[]) => void): void;
}

export interface IBasicSessionCall extends IBasicSessionCallCallback, IBasicSessionCallAsync {
    /**
     *
     *
     * @param methodToCall {CallMethodRequest} the call method request
     * @param callback
     *
     * @example :
     *
     * ```javascript
     * const methodToCall = {
     *     objectId: "ns=2;i=12",
     *     methodId: "ns=2;i=13",
     *     inputArguments: [
     *         new Variant({...}),
     *         new Variant({...}),
     *     ]
     * }
     * session.call(methodToCall,function(err,callResult) {
     *    if (!err) {
     *         console.log(" statusCode = ",callResult.statusCode);
     *         console.log(" inputArgumentResults[0] = ",callResult.inputArgumentResults[0].toString());
     *         console.log(" inputArgumentResults[1] = ",callResult.inputArgumentResults[1].toString());
     *         console.log(" outputArgument[0]       = ",callResult.outputArgument[0].toString()); // array of variant
     *    }
     * });
     * ```
     *
     *
     * @param methodsToCall {CallMethodRequest[]} the call method request array
     * @param callback
     *
     *
     * @example :
     *
     * ```javascript
     * const methodsToCall = [ {
     *     objectId: "ns=2;i=12",
     *     methodId: "ns=2;i=13",
     *     inputArguments: [
     *         new Variant({...}),
     *         new Variant({...}),
     *     ]
     * }];
     * session.call(methodsToCall,function(err,callResults) {
     *    if (!err) {
     *         const callResult = callResults[0];
     *         console.log(" statusCode = ",rep.statusCode);
     *         console.log(" inputArgumentResults[0] = ",callResult.inputArgumentResults[0].toString());
     *         console.log(" inputArgumentResults[1] = ",callResult.inputArgumentResults[1].toString());
     *         console.log(" outputArgument[0]       = ",callResult.outputArgument[0].toString()); // array of variant
     *    }
     * });
     * ```
     */

    call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
    call(methodToCall: CallMethodRequestLike, callback: (err: Error | null, result?: CallMethodResult) => void): void;
    call(methodsToCall: CallMethodRequestLike[], callback: (err: Error | null, results?: CallMethodResult[]) => void): void;
}

// #endregion

// #region TranslateBrowsePath
export interface IBasicSessionTranslateBrowsePathAsyncSimple {
    translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
}
export interface IBasicSessionTranslateBrowsePathAsyncMultiple {
    translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
}
export interface IBasicSessionTranslateBrowsePathAsync
    extends IBasicSessionTranslateBrowsePathAsyncSimple,
        IBasicSessionTranslateBrowsePathAsyncMultiple {
    translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
}
export interface IBasicSessionTranslateBrowsePathCallback {
    translateBrowsePath(browsesPath: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
}
export interface IBasicSessionTranslateBrowsePath
    extends IBasicSessionTranslateBrowsePathCallback,
        IBasicSessionTranslateBrowsePathAsync {
    translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
    translateBrowsePath(browsesPath: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
}

// #endregion

export interface IBasicSessionAsyncSimple extends 
        IBasicSessionBrowseAsyncSimple,
        IBasicSessionReadAsyncSimple,
        IBasicSessionWriteAsyncSimple,
        IBasicSessionCallAsyncSimple,
        IBasicSessionTranslateBrowsePathAsyncSimple {}


export interface IBasicSessionAsyncMultiple extends 
        IBasicSessionBrowseAsyncMultiple,
        IBasicSessionReadAsyncMultiple,
        IBasicSessionWriteAsyncMultiple,
        IBasicSessionCallAsyncMultiple,
        IBasicSessionTranslateBrowsePathAsyncMultiple {}

export interface IBasicSessionAsync extends  IBasicSessionBrowseAsync,
        IBasicSessionReadAsync,
        IBasicSessionWriteAsync,
        IBasicSessionCallAsync,
        IBasicSessionTranslateBrowsePathAsync {}
export type IVeryBasicSession = IBasicSessionAsync;

export interface IBasicSessionAsync2 extends IBasicSessionAsync, IBasicSessionBrowseNextAsync {}
export interface ITransportSettingProvider {
    getTransportSettings?: () => IBasicTransportSettings;
}

export interface IBasicSessionGetArgumentDefinitionCallback {
    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;
}
export interface IBasicSessionGetArgumentDefinitionAsync {
    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
}
export interface IBasicSessionGetArgumentDefinition extends IBasicSessionGetArgumentDefinitionAsync, IBasicSessionGetArgumentDefinitionCallback {
    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;

}

export type IBasicSessionCallback = IBasicSessionReadCallback &
    IBasicSessionBrowseNextCallback &
    IBasicSessionBrowseCallback &
    IBasicSessionTranslateBrowsePathCallback &
    IBasicSessionGetArgumentDefinitionCallback &
    IBasicSessionWriteCallback;

export interface IBasicSession
    extends ITransportSettingProvider,
        IBasicSessionBrowse,
        IBasicSessionBrowseNext,
        IBasicSessionCall,
        IBasicSessionRead,
        IBasicSessionTranslateBrowsePath,
        IBasicSessionWrite,
        IBasicSessionGetArgumentDefinition {
}

export type PrivateKeyPEM = string;
export interface UserIdentityInfoUserName {
    type: UserTokenType.UserName;
    userName: string;
    password: string;
}

export interface UserIdentityInfoX509 extends X509IdentityTokenOptions {
    type: UserTokenType.Certificate;
    certificateData: ByteString;
    privateKey: PrivateKeyPEM;
}
export interface AnonymousIdentity {
    type: UserTokenType.Anonymous;
}

export type UserIdentityInfo = AnonymousIdentity | UserIdentityInfoX509 | UserIdentityInfoUserName;

export interface IBasicSessionChangeUser {
    changeUser(userIdentityInfo: UserIdentityInfo): Promise<StatusCode>;
    changeUser(userIdentityInfo: UserIdentityInfo, callback: CallbackT<StatusCode>): void;
}

function isValid(result: DataValue): boolean {
    assert(result.statusCode.isGood());
    if (result.value.dataType !== DataType.Null) {
        assert(result.value.dataType === DataType.ExtensionObject);
        assert(result.value.arrayType === VariantArrayType.Array);
    }
    return true;
}

export async function getArgumentDefinitionHelper(
    session: IBasicSessionBrowseAsyncSimple & IBasicSessionReadAsyncMultiple,
    methodId: MethodId
): Promise<ArgumentDefinition> {
    const browseDescription = new BrowseDescription({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0, // makeNodeClassMask("Variable"),
        nodeId: methodId,
        referenceTypeId: resolveNodeId("HasProperty"),
        resultMask: makeResultMask("BrowseName")
    });

    const browseResult = await session.browse(browseDescription);
    browseResult.references = browseResult.references || [];

    const inputArgumentRefArray = browseResult.references.filter((r) => r.browseName.name === "InputArguments");

    // note : InputArguments property is optional thus may be missing
    const inputArgumentRef = inputArgumentRefArray.length === 1 ? inputArgumentRefArray[0] : null;

    const outputArgumentRefArray = browseResult.references.filter((r) => r.browseName.name === "OutputArguments");

    // note : OutputArguments property is optional thus may be missing
    const outputArgumentRef = outputArgumentRefArray.length === 1 ? outputArgumentRefArray[0] : null;

    let inputArguments: Argument[] = [];
    let outputArguments: Argument[] = [];

    const nodesToRead = [];
    const actions: any[] = [];

    if (inputArgumentRef) {
        nodesToRead.push({
            attributeId: AttributeIds.Value,
            nodeId: inputArgumentRef.nodeId
        });
        actions.push((result: DataValue) => {
            if (isValid(result)) {
                inputArguments = result.value.value as Argument[];
            }
        });
    }
    if (outputArgumentRef) {
        nodesToRead.push({
            attributeId: AttributeIds.Value,
            nodeId: outputArgumentRef.nodeId
        });
        actions.push((result: DataValue) => {
            assert(result.statusCode.isGood());
            if (isValid(result)) {
                outputArguments = result.value.value as Argument[];
            }
        });
    }

    if (nodesToRead.length === 0) {
        return { inputArguments, outputArguments };
    }
    // now read the variable
    const dataValues = await session.read(nodesToRead);

    dataValues.forEach((dataValue, index) => {
        actions[index].call(null, dataValue);
    });

    return { inputArguments, outputArguments };
}

interface SessionWithCache extends IBasicSessionAsync2 {
    $$namespaceArray?: string[] | null;
}


type ICascadingSession = { session?: IBasicSessionReadAsyncSimple }
function followSession(session: IBasicSessionReadAsyncSimple & ICascadingSession): SessionWithCache {
    if (session.session) {
        return followSession(session.session);
    }
    return session as SessionWithCache;
}


export async function readNamespaceArray(session: IBasicSessionReadAsyncSimple): Promise<string[]> {

    const sessionHoldingCache = followSession(session) as SessionWithCache;
    if (sessionHoldingCache.$$namespaceArray)  {
        return sessionHoldingCache.$$namespaceArray!;
    }
    const nodeId = resolveNodeId(VariableIds.Server_NamespaceArray);

    const dataValue = await session.read({
        nodeId,
        attributeId: AttributeIds.Value
    });
    if (dataValue.statusCode.isNotGood()) {
        // errorLog("namespaceArray is not populated ! Your server must expose a list of namespaces in node ", nodeId.toString());
        return [];
    }
    sessionHoldingCache.$$namespaceArray = dataValue.value.value; // keep a cache
    return sessionHoldingCache.$$namespaceArray!;
}

export async function clearSessionCache(session: IBasicSessionAsync2) {
    const sessionHoldingCache = followSession(session) as SessionWithCache;
    sessionHoldingCache.$$namespaceArray = undefined;
}