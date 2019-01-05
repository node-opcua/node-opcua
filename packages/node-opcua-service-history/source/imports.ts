/**
 * @module node-opcua-service-history
 */
import { TimestampsToReturn } from "node-opcua-data-value";

export {
    AggregateConfiguration,
    HistoryData,
    HistoryModifiedData,
    HistoryReadDetails,
    HistoryReadValueId,
    HistoryReadResult,
    HistoryUpdateResult,
    HistoryReadRequest,
    HistoryReadResponse,
    HistoryUpdateRequest,
    HistoryUpdateResponse,

    ReadRawModifiedDetails,
    ReadProcessedDetails,
    ReadAtTimeDetails,

    HistoryUpdateType,

    ModificationInfo,
    ReadEventDetails,
    HistoryReadRequestOptions
} from "node-opcua-types";
import { assert } from "node-opcua-assert";
import { HistoryReadRequest } from "node-opcua-types";

assert(HistoryReadRequest.schema.fields[2].name === "timestampsToReturn");
HistoryReadRequest.schema.fields[2].defaultValue = TimestampsToReturn.Neither;
