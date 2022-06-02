/**
 * @module node-opcua-pseudo-session
 */
import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseResult
} from "node-opcua-service-browse";
import { Argument, CallMethodRequestOptions, CallMethodResult } from "node-opcua-service-call";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { WriteValueOptions } from "node-opcua-service-write";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { VariableIds } from "node-opcua-constants";

export type BrowseDescriptionLike = string | BrowseDescriptionOptions;
export type CallMethodRequestLike = CallMethodRequestOptions;

export type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export interface IBasicSession {
    browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;

    browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;

    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
}
export interface IBasicSession {
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

    browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;

    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
}
export interface IBasicSession {
    read(nodeToRead: ReadValueIdOptions, maxAge: number, callback: ResponseCallback<DataValue>): void;

    read(nodesToRead: ReadValueIdOptions[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;

    read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;

    read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;

    read(nodeToRead: ReadValueIdOptions, maxAge?: number): Promise<DataValue>;

    read(nodesToRead: ReadValueIdOptions[], maxAge?: number): Promise<DataValue[]>;
}

export type MethodId = NodeIdLike;

export interface ArgumentDefinition {
    inputArguments: Argument[];
    outputArguments: Argument[];
}

export interface IBasicSession {
    call(methodToCall: CallMethodRequestLike, callback: (err: Error | null, result?: CallMethodResult) => void): void;

    call(methodsToCall: CallMethodRequestLike[], callback: (err: Error | null, results?: CallMethodResult[]) => void): void;

    call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;

    call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;

    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;

    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;
}

export interface IBasicSession {
    translateBrowsePath(browsesPath: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;

    translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;

    translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;

    translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
}

export interface IBasicSession {
    write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;

    write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;

    write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;

    write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
}

function isValid(result: DataValue): boolean {
    assert(result.statusCode === StatusCodes.Good);
    if (result.value.dataType !== DataType.Null) {
        assert(result.value.dataType === DataType.ExtensionObject);
        assert(result.value.arrayType === VariantArrayType.Array);
    }
    return true;
}

export function getArgumentDefinitionHelper(
    session: IBasicSession,
    methodId: MethodId,
    callback: ResponseCallback<ArgumentDefinition>
): void {
    const browseDescription = new BrowseDescription({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0, // makeNodeClassMask("Variable"),
        nodeId: methodId,
        referenceTypeId: resolveNodeId("HasProperty"),
        resultMask: makeResultMask("BrowseName")
    });

    session.browse(browseDescription, (err: Error | null, browseResult?: BrowseResult) => {
        /* istanbul ignore next */
        if (err) {
            return callback(err);
        }
        if (!browseResult) {
            return callback(new Error("Invalid"));
        }

        browseResult.references = browseResult.references || [];

        // xx console.log("xxxx results", util.inspect(results, {colors: true, depth: 10}));
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
                assert(result.statusCode === StatusCodes.Good);
                if (isValid(result)) {
                    outputArguments = result.value.value as Argument[];
                }
            });
        }

        if (nodesToRead.length === 0) {
            return callback(null, { inputArguments, outputArguments });
        }
        // now read the variable
        session.read(nodesToRead, (err1: Error | null, dataValues?: DataValue[]) => {
            /* istanbul ignore next */
            if (err1) {
                return callback(err1);
            }
            /* istanbul ignore next */
            if (!dataValues) {
                return callback(new Error("Internal Error"));
            }

            dataValues.forEach((dataValue, index) => {
                actions[index].call(null, dataValue);
            });

            callback(null, { inputArguments, outputArguments });
        });
    });
}

export async function readNamespaceArray(session: IBasicSession): Promise<string[]> {
    const nodeId = resolveNodeId(VariableIds.Server_NamespaceArray);
    const dataValue = await session.read({
        nodeId,
        attributeId: AttributeIds.Value
    });
    if (dataValue.statusCode !== StatusCodes.Good) {
        // errorLog("namespaceArray is not populated ! Your server must expose a list of namespaces in node ", nodeId.toString());
        return [];
    }
    return dataValue.value.value as string[];
}
