/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { BrowseResultOptions, ReferenceDescription } from "node-opcua-types";
import {
    ContinuationPoint,
    IContinuationPointManager,
    IContinuationPointInfo,
    IContinuationPointInfo2,
    ContinuationStuff
} from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";

/***
 * A ContinuationPoint is used to pause a Browse, QueryFirst or HistoryRead operation and allow it to be restarted later by calling BrowseNext,
 * QueryNext or HistoryRead.
 * - Operations are paused when the number of results found exceeds the limits set by either the Client or the Server.
 * - The Client specifies the maximum number of results per operation in the request message.
 * - A Server shall not return more than this number of results but it may return fewer results.
 * - The Server allocates a  ContinuationPoint if there are more results to return.
 * - Servers shall support at least one ContinuationPoint per Session.
 * - Servers specify a maximum number of ContinuationPoints per Session in the ServerCapabilities Object defined in OPC 10000-5.
 * - ContinuationPoints remain active until
 *     a/ the Client retrieves the remaining results,
 *     b/ or, the Client releases the ContinuationPoint
 *     c/ or the Session is closed.
 * - A Server shall automatically free ContinuationPoints from prior requests from a Session if they are needed to process a new request
 *   from this Session.
 * - The Server returns a Bad_ContinuationPointInvalid error if a Client tries to use a ContinuationPoint that has been released.
 * - A Client can avoid this situation by completing paused operations before starting new operations.
 * - Requests will often specify multiple operations that may or may not require a ContinuationPoint.
 * - A Server shall process the operations until it uses the maximum number of continuation points in this response.
 *   Once that happens the Server shall return a Bad_NoContinuationPoints error for any remaining operations. A Client can avoid
 *   this situation by sending requests with a number of operations that do not exceed the maximum number  of ContinuationPoints
 *   per Session defined for the Service in the ServerCapabilities Object defined in OPC 10000-5.
 *   A Client restarts an operation by passing the ContinuationPoint back to the Server. Server should always be able to reuse the ContinuationPoint
 *   provided so Servers shall never return Bad_NoContinuationPoints error when continuing a previously halted operation.
 *   A ContinuationPoint is a subtype of the ByteString data type.
 */
let counter = 0;

function make_key() {
    // return crypto.randomBytes(32);
    counter += 1;
    return Buffer.from(counter.toString(), "ascii");
}

export interface ContinuationPointInfo extends BrowseResultOptions, IContinuationPointInfo {
    references?: ReferenceDescription[];
    statusCode: StatusCode;
}

export class ContinuationPointManager implements IContinuationPointManager {
    private _map: any;
    constructor() {
        this._map = {};
    }

    /**
     * returns true if the current number of active continuation point has reach the limit
     * specified in maxBrowseContinuationPoint
     * @param maxBrowseContinuationPoint
     */
    public hasReachMaximum(maxBrowseContinuationPoint: number): boolean {
        if (maxBrowseContinuationPoint === 0) {
            return false;
        }
        const nbContinuationPoints = Object.keys(this._map).length;
        return nbContinuationPoints >= maxBrowseContinuationPoint;
    }

    public clearContinuationPoints() {
        // call when a new request to the server is received
        this._map = {};
    }

    public registerHistoryReadRaw(
        numValuesPerNode: number,
        dataValues: DataValue[],
        continuationData: ContinuationStuff
    ): IContinuationPointInfo2 {
        if (continuationData.releaseContinuationPoints || (!continuationData.continuationPoint && continuationData.index === 0)) {
            this.clearContinuationPoints();
        }
        // now make sure that only the requested number of value is returned
        if (numValuesPerNode >= 1) {
            if (dataValues.length === 0) {
                return {
                    continuationPoint: undefined,
                    dataValues: undefined,
                    statusCode: StatusCodes.GoodNoData
                };
            }
        }

        numValuesPerNode = numValuesPerNode || dataValues.length;
        if (numValuesPerNode >= dataValues.length) {
            return {
                continuationPoint: undefined,
                dataValues,
                statusCode: StatusCodes.Good
            };
        }
        // split the array in two ( values)
        const current_block = dataValues.splice(0, numValuesPerNode);

        if (continuationData.releaseContinuationPoints) {
            return {
                continuationPoint: undefined,
                dataValues: current_block,
                statusCode: StatusCodes.Good
            };
        }
        const key = make_key();
        const keyHash = key.toString("ascii");

        const result = {
            continuationPoint: key,
            dataValues: current_block,
            statusCode: StatusCodes.Good
        };

        // create
        const data = {
            maxElements: numValuesPerNode,
            dataValues
        };
        this._map[keyHash] = data;

        return result;
    }
    public getNextHistoryReadRaw(numValues: number, continuationData: ContinuationStuff): IContinuationPointInfo2 {
        if (!continuationData.continuationPoint) {
            return { statusCode: StatusCodes.BadContinuationPointInvalid };
        }
        const keyHash = continuationData.continuationPoint.toString("ascii");
        const data = this._map[keyHash];
        if (!data) {
            return { statusCode: StatusCodes.BadContinuationPointInvalid };
        }
        const cnt = data;
        const dataValues = cnt.dataValues.splice(0, numValues);

        let continuationPoint: ContinuationPoint | undefined = continuationData.continuationPoint;
        if (cnt.dataValues.length === 0 || continuationData.releaseContinuationPoints) {
            // no more data available for next call
            delete this._map[keyHash];
            continuationPoint = undefined;
        }
        return {
            continuationPoint,
            dataValues,
            statusCode: StatusCodes.Good
        };
    }
    //////
    public register(maxElements: number, values: ReferenceDescription[]): ContinuationPointInfo {
        maxElements = maxElements || values.length;
        if (maxElements >= values.length) {
            return {
                continuationPoint: undefined,
                references: values,
                statusCode: StatusCodes.Good
            };
        }

        const key = make_key();
        const keyHash = key.toString("ascii");

        // split the array in two ( values)
        const current_block = values.splice(0, maxElements);

        const result = {
            continuationPoint: key,
            references: current_block,
            statusCode: StatusCodes.Good
        };

        // create
        const data = {
            maxElements,
            remainingElements: values
        };
        this._map[keyHash] = data;

        return result;
    }

    public getNext(continuationPoint: ContinuationPoint): ContinuationPointInfo {
        if (!continuationPoint) {
            return { statusCode: StatusCodes.BadContinuationPointInvalid };
        }
        const keyHash = continuationPoint.toString("ascii");

        const data = this._map[keyHash];
        if (!data) {
            return { statusCode: StatusCodes.BadContinuationPointInvalid };
        }
        assert(data.maxElements > 0);
        // split the array in two ( values)
        const current_block = data.remainingElements.splice(0, data.maxElements);

        const result = {
            continuationPoint: data.remainingElements.length ? continuationPoint : undefined,
            references: current_block,
            statusCode: StatusCodes.Good
        };
        if (data.remainingElements.length === 0) {
            // we are done
            delete this._map[keyHash];
        }
        return result;
    }

    public cancel(continuationPoint: ContinuationPoint): ContinuationPointInfo {
        if (!continuationPoint) {
            return { statusCode: StatusCodes.BadContinuationPointInvalid };
        }

        const keyHash = continuationPoint.toString("ascii");

        const data = this._map[keyHash];
        if (!data) {
            return {
                continuationPoint: undefined, // nullBuffer,
                references: [],
                statusCode: StatusCodes.BadContinuationPointInvalid
            };
        }
        delete this._map[keyHash];
        return {
            statusCode: StatusCodes.Good
        };
    }
}
