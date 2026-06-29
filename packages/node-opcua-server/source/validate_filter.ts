/**
 * @module node-opcua-server
 */

import type { BaseNode, UAVariable } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { DataType } from "node-opcua-basic-types";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import { type INodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { type ContentFilter, DataChangeFilter, EventFilter, validateContentFilter } from "node-opcua-service-filter";
import { DeadbandType } from "node-opcua-service-subscription";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";

const warningLog = make_warningLog(__filename);

function isNumberDataType(node: UAVariable): boolean {
    const n = node.dataType as INodeId;
    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value < 22) {
        switch (n.value) {
            case DataType.Float:
            case DataType.Double:
            case DataType.Byte:
            case DataType.SByte:
            case DataType.Int16:
            case DataType.Int32:
            case DataType.Int64:
            case DataType.UInt16:
            case DataType.UInt32:
            case DataType.UInt64:
                return true;
            default:
                return false;
        }
    }
    const dataType = node.addressSpace.findDataType(node.dataType)!;
    const dataTypeNumber = node.addressSpace.findDataType("Number")!;
    return dataType.isSubtypeOf(dataTypeNumber);
}

function __validateDataChangeFilter(filter: DataChangeFilter, itemToMonitor: ReadValueIdOptions, node: UAVariable): StatusCode {
    assert(itemToMonitor.attributeId === AttributeIds.Value);
    if (node.nodeClass !== NodeClass.Variable) {
        return StatusCodes.BadNodeIdInvalid;
    }

    if (filter.deadbandType !== DeadbandType.None) {
        // if node is not Numerical=> DataChangeFilter
        assert(node.dataType instanceof NodeId);
        if (!isNumberDataType(node)) {
            return StatusCodes.BadFilterNotAllowed;
        }
    }

    if (filter.deadbandType === DeadbandType.Percent) {
        if (filter.deadbandValue < 0 || filter.deadbandValue > 100) {
            return StatusCodes.BadDeadbandFilterInvalid;
        }

        // node must also have a valid euRange
        if (!node.getChildByName("EURange", 0)) {
            warningLog(" node has no euRange ! Dead band Percent cannot be used on node " + node.nodeId.toString());
            return StatusCodes.BadMonitoredItemFilterUnsupported;
        }
    }
    return StatusCodes.Good;
}

export interface ValidateFilterOptions {
    // ServerCapabilities.MaxWhereClauseParameters: maximum number of whereClause operands (OPC UA Part 5)
    maxWhereClauseParameters?: number;
    // ServerCapabilities.MaxSelectClauseParameters: maximum number of selectClauses (OPC UA Part 5)
    maxSelectClauseParameters?: number;
}

function __countWhereClauseParameters(whereClause: ContentFilter): number {
    let count = 0;
    for (const element of whereClause.elements || []) {
        count += element?.filterOperands?.length || 0;
    }
    return count;
}

function __validateEventFilter(filter: EventFilter, options?: ValidateFilterOptions): StatusCode {
    // Enforce the ServerCapabilities limits on the size of the filter (OPC UA Part 5). This bounds the
    // amount of work the filter can require and the depth of the whereClause evaluation.
    const maxSelectClauseParameters = options?.maxSelectClauseParameters;
    if (maxSelectClauseParameters !== undefined && (filter.selectClauses?.length || 0) > maxSelectClauseParameters) {
        return StatusCodes.BadEventFilterInvalid;
    }
    const maxWhereClauseParameters = options?.maxWhereClauseParameters;
    if (
        maxWhereClauseParameters !== undefined &&
        filter.whereClause &&
        __countWhereClauseParameters(filter.whereClause) > maxWhereClauseParameters
    ) {
        return StatusCodes.BadEventFilterInvalid;
    }

    // Validate the structure of the whereClause ContentFilter (operand counts, in-bounds and acyclic
    // ElementOperand references) up front, instead of accepting it and only resolving it to false
    // when an event is evaluated. See OPC UA Part 4 - 7.7.
    if (filter.whereClause) {
        return validateContentFilter(filter.whereClause);
    }
    return StatusCodes.Good;
}

export function validateFilter(
    filter: ExtensionObject | null,
    itemToMonitor: ReadValueIdOptions,
    node: BaseNode,
    options?: ValidateFilterOptions
): StatusCode {
    // handle filter information
    if (filter && filter instanceof EventFilter && itemToMonitor.attributeId !== AttributeIds.EventNotifier) {
        // invalid filter on Event
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter && filter instanceof DataChangeFilter && itemToMonitor.attributeId !== AttributeIds.Value) {
        // invalid DataChange filter on non Value Attribute
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter && itemToMonitor.attributeId !== AttributeIds.EventNotifier && itemToMonitor.attributeId !== AttributeIds.Value) {
        return StatusCodes.BadFilterNotAllowed;
    }

    if (filter instanceof DataChangeFilter) {
        return __validateDataChangeFilter(filter, itemToMonitor, node as UAVariable);
    }

    if (filter instanceof EventFilter) {
        return __validateEventFilter(filter, options);
    }

    return StatusCodes.Good;
}
