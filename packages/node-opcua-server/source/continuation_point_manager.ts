/**
 * @module node-opcua-server
 */
import { ContinuationPoint } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    BrowseResultOptions,
    ReferenceDescription
} from "node-opcua-types";

let counter = 0;

function make_key() {
    // return crypto.randomBytes(32);
    counter += 1;
    return Buffer.from(counter.toString(), "ascii");
}

export interface ContinuationPointInfo extends BrowseResultOptions {
    continuationPoint?: ContinuationPoint;
    references?: ReferenceDescription[];
    statusCode: StatusCode;
}

export class ContinuationPointManager {

    private readonly _map: any;

    constructor() {
        this._map = {};
    }

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
