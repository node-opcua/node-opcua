/**
 * @module node-opcua-pseudo-session
 */
import { AttributeIds, BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseRequest,
    BrowseResponse,
    BrowseResult
} from "node-opcua-service-browse";
import {
    CallMethodRequest,
    CallMethodRequestOptions,
    CallMethodResult
} from "node-opcua-service-call";
import {
    ReadValueId,
    ReadValueIdOptions
} from "node-opcua-service-read";
import { Variant } from "node-opcua-variant";

export type BrowseDescriptionLike = string | BrowseDescriptionOptions | BrowseDescription;
export type ReadValueIdLike = ReadValueId | ReadValueIdOptions;
export type CallMethodRequestLike = CallMethodRequestOptions | CallMethodRequest;

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
     *      TRUE passed continuationPoints shall be reset to free resources in
     *      the Server. The continuation points are released and the results
     *      and diagnosticInfos arrays are empty.
     *      FALSE passed continuationPoints shall be used to get the next set of
     *      browse information.
     *      A Client shall always use the continuation point returned by a Browse or
     *      BrowseNext response to free the resources for the continuation point in the
     *      Server. If the Client does not want to get the next set of browse information,
     *      BrowseNext shall be called with this parameter set to TRUE.
     * @param callback
     */
    browseNext(
      continuationPoint: Buffer,
      releaseContinuationPoints: boolean,
      callback: ResponseCallback<BrowseResult>): void;

    browseNext(
      continuationPoints: Buffer[],
      releaseContinuationPoints: boolean,
      callback: ResponseCallback<BrowseResult[]>): void;

    browseNext(
      continuationPoint: Buffer,
      releaseContinuationPoints: boolean
    ): Promise<BrowseResult>;

    browseNext(
      continuationPoints: Buffer[],
      releaseContinuationPoints: boolean
    ): Promise<BrowseResult[]>;
}
export interface IBasicSession {

    read(nodeToRead: ReadValueIdLike, callback: ResponseCallback<DataValue>): void;

    read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;

    read(nodeToRead: ReadValueIdLike): Promise<DataValue>;

    read(nodesToRead: ReadValueIdLike[]): Promise<DataValue[]>;

}

export type MethodId = NodeIdLike ;

export interface ArgumentDefinition {
    inputArguments: Variant[];
    outputArguments: Variant[];
}

export interface IBasicSession {

    call(
      methodToCall: CallMethodRequestLike,
      callback: (err: Error | null, result?: CallMethodResult) => void): void;

    call(
      methodsToCall: CallMethodRequestLike[],
      callback: (err: Error | null, results?: CallMethodResult[]) => void): void;

    call(
      methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;

    call(
      methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;

    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;

    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;

}

export function getArgumentDefinitionHelper(
  session: IBasicSession,
  methodId: MethodId,
  callback: ResponseCallback<ArgumentDefinition>
) {

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
        const inputArgumentRefArray = browseResult.references.filter(
          (r) => r.browseName.name === "InputArguments");

        // note : InputArguments property is optional thus may be missing
        const inputArgumentRef = (inputArgumentRefArray.length === 1) ? inputArgumentRefArray[0] : null;

        const outputArgumentRefArray = browseResult.references.filter(
          (r) => r.browseName.name === "OutputArguments");

        // note : OutputArguments property is optional thus may be missing
        const outputArgumentRef = (outputArgumentRefArray.length === 1) ? outputArgumentRefArray[0] : null;

        let inputArguments: Variant[] = [];
        let outputArguments: Variant[] = [];

        const nodesToRead = [];
        const actions: any[] = [];

        if (inputArgumentRef) {
            nodesToRead.push({
                attributeId: AttributeIds.Value,
                nodeId: inputArgumentRef.nodeId
            });
            actions.push((result: DataValue) => {
                inputArguments = result.value.value;
            });
        }
        if (outputArgumentRef) {
            nodesToRead.push({
                attributeId: AttributeIds.Value,
                nodeId: outputArgumentRef.nodeId
            });
            actions.push((result: DataValue) => {
                outputArguments = result.value.value;
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
