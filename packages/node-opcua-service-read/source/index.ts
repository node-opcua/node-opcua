/**
 * @module node-opcua-service-read
 */
import { assert } from "node-opcua-assert";
import { AttributeIds, isValidAttributeId } from "node-opcua-data-model";
import { TimestampsToReturn } from "node-opcua-data-value";
import { ReadRequest, ReadValueId } from "node-opcua-types";

assert(ReadRequest.schema.fields[2].name === "timestampsToReturn");
ReadRequest.schema.fields[2].defaultValue = () => TimestampsToReturn.Both;

assert(ReadValueId.schema.fields[1].name === "attributeId");
ReadValueId.schema.fields[1].defaultValue = () => AttributeIds.Value;
ReadValueId.schema.fields[1].validate = (value: number) => {
    return isValidAttributeId(value) || value === AttributeIds.INVALID;
};

export {
    AttributeIds,
    attributeNameById
} from "node-opcua-data-model";
export { TimestampsToReturn } from "node-opcua-data-value";
export {
    RequestHeader,
    ResponseHeader
} from "node-opcua-service-secure-channel";
// --------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//  --------------------------------------------------------------------------------
export {
    ReadRequest,
    ReadRequestOptions,
    ReadResponse,
    ReadResponseOptions,
    ReadValueId,
    ReadValueIdOptions
} from "node-opcua-types";
