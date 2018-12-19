/**
 * @module node-opcua-service-read
 */
import { assert } from "node-opcua-assert";
import {
    ReadRequest, ReadResponse, ReadValueId
} from "node-opcua-types";

import { AttributeIds, isValidAttributeId } from "node-opcua-data-model";
import {
    TimestampsToReturn
} from "node-opcua-data-value";

assert(ReadRequest.schema.fields[2].name === "timestampsToReturn");
ReadRequest.schema.fields[2].defaultValue = () => TimestampsToReturn.Both;

assert(ReadValueId.schema.fields[1].name === "attributeId");
ReadValueId.schema.fields[1].defaultValue = () => AttributeIds.Value;
ReadValueId.schema.fields[1].validate = (value: any) => {
    return isValidAttributeId(value) || value === AttributeIds.INVALID;
};

export {
    RequestHeader, ResponseHeader
} from "node-opcua-service-secure-channel";

// --------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//  --------------------------------------------------------------------------------
export {
    ReadValueId,
    ReadRequest,
    ReadResponse,
    ReadValueIdOptions,
    ReadRequestOptions,
    ReadResponseOptions
} from "node-opcua-types";

export {
    attributeNameById,
    AttributeIds
} from "node-opcua-data-model";
export {
    TimestampsToReturn
} from "node-opcua-data-value";
