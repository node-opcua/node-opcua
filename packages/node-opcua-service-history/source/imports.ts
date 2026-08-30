/**
 * @module node-opcua-service-history
 */
import { TimestampsToReturn } from "node-opcua-data-value";

export type { HistoryReadRequestOptions } from "node-opcua-types";
export {
    AggregateConfiguration,
    HistoryData,
    HistoryModifiedData,
    HistoryReadDetails,
    HistoryReadRequest,
    HistoryReadResponse,
    HistoryReadResult,
    HistoryReadValueId,
    HistoryUpdateRequest,
    HistoryUpdateResponse,
    HistoryUpdateResult,
    HistoryUpdateType,
    ModificationInfo,
    ReadAtTimeDetails,
    ReadEventDetails,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-types";

import { assert } from "node-opcua-assert";
import { HistoryReadRequest } from "node-opcua-types";

assert(HistoryReadRequest.schema.fields[2].name === "timestampsToReturn");
HistoryReadRequest.schema.fields[2].defaultValue = TimestampsToReturn.Neither;
