/**
 * @module node-opcua-server
 */
import { StatusCodes } from "node-opcua-status-code";
import { ReferenceDescription } from "node-opcua-types";
import {
    ContinuationPoint,
    IContinuationPointManager,
    IContinuationPointInfo,
    ContinuationData
} from "node-opcua-address-space-base";
import { DataValue } from "node-opcua-data-value";

/**
 * from https://reference.opcfoundation.org/v104/Core/docs/Part4/7.6/
 *
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
 *   For Session-less Service invocations, the ContinuationPoints are shared across all Session-less Service invocations from all Clients. 
 *   The Server shall support at least the maximum number of ContinuationPoints it would allow for one Session.
 * 
 * - Requests will often specify multiple operations that may or may not require a ContinuationPoint.
 * - A Server shall process the operations until it uses the maximum number of continuation points in this response.
 *   Once that happens the Server shall return a Bad_NoContinuationPoints error for any remaining operations. A Client can avoid
 *   this situation by sending requests with a number of operations that do not exceed the maximum number  of ContinuationPoints
 *   per Session defined for the Service in the ServerCapabilities Object defined in OPC 10000-5.
 *   A Client restarts an operation by passing the ContinuationPoint back to the Server. Server should always be able to reuse the ContinuationPoint
 *   provided so Servers shall never return Bad_NoContinuationPoints error when continuing a previously halted operation.
 *   A ContinuationPoint is a subtype of the ByteString data type.
 *
 * 
 * for historical access: https://reference.opcfoundation.org/v104/Core/docs/Part11/6.3/
 *
 * The continuationPoint parameter in the HistoryRead Service is used to mark a point from which to continue
 * the read if not all values could be returned in one response. The value is opaque for the Client and is
 * only used to maintain the state information for the Server to continue from. *
 *
 * For HistoricalDataNode requests, a Server may use the timestamp of the last returned data item if the timestamp
 * is unique. This can reduce the need in the Server to store state information for the continuation point.
 * The Client specifies the maximum number of results per operation in the request Message. A Server shall
 * not return more than this number of results but it may return fewer results. The Server allocates a
 * ContinuationPoint if there are more results to return. The Server may return fewer results due to buffer issues
 * or other internal constraints. It may also be required to return a continuationPoint due to HistoryRead
 * parameter constraints. If a request is taking a long time to calculate and is approaching the timeout time, the
 * Server may return partial results with a continuation point. This may be done if the calculation is going to
 * take more time than the Client timeout. In some cases it may take longer than the Client timeout to calculate
 * even one result. Then the Server may return zero results with a continuation point that allows the Server to
 * resume the calculation on the next Client read call. For additional discussions regarding ContinuationPoints
 * and HistoryRead please see the individual extensible HistoryReadDetails parameter in 6.4.
 * If the Client specifies a ContinuationPoint, then the HistoryReadDetails parameter and the TimestampsToReturn
 * parameter are ignored, because it does not make sense to request different parameters when continuing from a
 * previous call. It is permissible to change the dataEncoding parameter with each request.
 * If the Client specifies a ContinuationPoint that is no longer valid, then the Server shall return a
 * Bad_ContinuationPointInvalid error.
 * If the releaseContinuationPoints parameter is set in the request the Server shall not return any data and shall
 * release all ContinuationPoints passed in the request. If the ContinuationPoint for an operation is missing or
 * invalid then the StatusCode for the operation shall be Bad_ContinuationPointInvalid.
 */
let counter = 0;

function make_key() {
    // return crypto.randomBytes(32);
    counter += 1;
    return Buffer.from(counter.toString(), "utf-8");
}

interface Data {
    maxElements: number;
    values: ReferenceDescription[] | DataValue[];
}
export class ContinuationPointManager implements IContinuationPointManager {
    private _map: Map<string, Data>;

    constructor() {
        this._map = new Map();
    }

    /**
     * returns true if the current number of active continuation point has reached the limit
     * specified in maxContinuationPoint
     * @param maxBrowseContinuationPoint
     */
    public hasReachedMaximum(maxContinuationPoint: number): boolean {
        if (maxContinuationPoint === 0) {
            return false;
        }
        const nbContinuationPoints = this._map.size;
        return nbContinuationPoints >= maxContinuationPoint;
    }

    public clearContinuationPoints() {
        // call when a new request to the server is received
        this._map.clear();
    }

    public registerHistoryReadRaw(
        numValuesPerNode: number,
        dataValues: DataValue[],
        continuationData: ContinuationData
    ): IContinuationPointInfo<DataValue> {
        return this._register(numValuesPerNode, dataValues, continuationData);
    }
    public getNextHistoryReadRaw(numValues: number, continuationData: ContinuationData): IContinuationPointInfo<DataValue> {
        return this._getNext(numValues, continuationData);
    }

    registerReferences(
        maxElements: number,
        values: ReferenceDescription[],
        continuationData: ContinuationData
    ): IContinuationPointInfo<ReferenceDescription> {
        return this._register(maxElements, values, continuationData);
    }
    /**
     * - releaseContinuationPoints = TRUE
     *
     *  passed continuationPoints shall be reset to free resources in
     *  the Server. The continuation points are released and the results
     *  and diagnosticInfos arrays are empty.
     *
     * - releaseContinuationPoints = FALSE
     *
     *   passed continuationPoints shall be used to get the next set of
     *   browse information
     */
    getNextReferences(numValues: number, continuationData: ContinuationData): IContinuationPointInfo<ReferenceDescription> {
        return this._getNext(numValues, continuationData);
    }

    private _register<T extends DataValue | ReferenceDescription>(
        maxValues: number,
        values: T[],
        continuationData: ContinuationData
    ): IContinuationPointInfo<T> {
        if (continuationData.releaseContinuationPoints) {
            this.clearContinuationPoints();
            return {
                continuationPoint: undefined,
                values: [],
                statusCode: StatusCodes.Good
            };
        }
        if (!continuationData.continuationPoint && !continuationData.index) {
            this.clearContinuationPoints();
        }

        if (maxValues >= 1) {
            // now make sure that only the requested number of value is returned
            if (values.length === 0) {
                return {
                    continuationPoint: undefined,
                    values: null,
                    statusCode: StatusCodes.GoodNoData
                };
            }
        }

        maxValues = maxValues || values.length;
        if (maxValues >= values.length) {
            return {
                continuationPoint: undefined,
                values,
                statusCode: StatusCodes.Good
            };
        }
        // split the array in two ( values)
        const current_block = values.splice(0, maxValues);

        const key = make_key();
        const keyHash = key.toString("utf-8");

        const result = {
            continuationPoint: key,
            values: current_block,
            statusCode: StatusCodes.Good
        };

        // create
        const data: Data = {
            maxElements: maxValues,
            values: values as DataValue[] | ReferenceDescription[]
        };
        this._map.set(keyHash, data);

        return result;
    }

    private _getNext<T extends DataValue | ReferenceDescription>(
        numValues: number,
        continuationData: ContinuationData
    ): IContinuationPointInfo<T> {
        if (!continuationData.continuationPoint) {
            return {
                continuationPoint: undefined,
                values: null,
                statusCode: StatusCodes.BadContinuationPointInvalid
            };
        }
        const keyHash = continuationData.continuationPoint.toString("utf-8");
        const data = this._map.get(keyHash);
        if (!data) {
            return {
                continuationPoint: undefined,
                values: null,
                statusCode: StatusCodes.BadContinuationPointInvalid
            };
        }

        const values = data.values.splice(0, numValues || data.maxElements) as T[];

        let continuationPoint: ContinuationPoint | undefined = continuationData.continuationPoint;
        if (data.values.length === 0 || continuationData.releaseContinuationPoints) {
            // no more data available for next call
            this._map.delete(keyHash);
            continuationPoint = undefined;
        }
        return {
            continuationPoint,
            values,
            statusCode: StatusCodes.Good
        };
    }
}
