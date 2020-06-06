import {
    SessionContext,
    IEventData,
    AddressSpace,
    extractEventFields
} from "../../source";
import {
    ContentFilter, FilterOperator, LiteralOperand, SimpleAttributeOperand
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";

import { UAObjectType } from "../ua_object_type";
import { UAReferenceType } from "../ua_reference_type";
import { UAVariableType } from "../ua_variable_type";
import { UAObject } from "../ua_object";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { UAVariable } from "../ua_variable";

function checkOfType(
    addressSpace: AddressSpace,
    ofType: LiteralOperand,
    eventData: IEventData
): boolean {

    // istanbul ignore next
    if (!ofType) {
        throw new Error("invalid operand");
    }
    // istanbul ignore next
    if (ofType.value.dataType !== DataType.NodeId) {
        throw new Error("invalid operand type (expecting Nodeid");
    }

    const ofTypeNode = addressSpace.findNode(ofType.value.value) as UAObjectType | UAReferenceType | UAVariableType;

    // istanbul ignore next
    if (!ofTypeNode) {
        return false; // the ofType node is not known, we don't know what to do
    }

    // istanbul ignore next
    if (ofTypeNode.nodeClass !== NodeClass.ObjectType) {
        throw new Error("operaand should be a ObjectType " + ofTypeNode.nodeId.toString());
    }
    const node = eventData.$eventDataSource! as (UAObjectType | UAObject | UAReferenceType | UAVariableType);
    if (!node) {
        throw new Error("cannot find  node " + eventData.$eventDataSource?.toString());
    }
    if (node instanceof UAObjectType) {
        return node.isSupertypeOf(ofTypeNode);
    }
    if (node instanceof UAObject && node.typeDefinitionObj) {
        return node.typeDefinitionObj.isSupertypeOf(ofTypeNode);
    }
    return true;
}

function _extractValue(operand: SimpleAttributeOperand, eventData: IEventData): NodeId | null {
    // eventData.readValue;
    const v = extractEventFields(SessionContext.defaultContext, [operand], eventData)[0];
    return v.value as NodeId;
}

function checkInList(
    addressSpace: AddressSpace,
    filterOperands: ExtensionObject[],
    eventData: IEventData
): boolean {

    const operand0 = filterOperands[0];
    if (!(operand0 instanceof SimpleAttributeOperand)) {
        // unsupported case
        return false;
    }
    const nodeId: NodeId | null = _extractValue(operand0, eventData);
    if (!nodeId) {
        return false;
    }
    function _is(nodeId1: NodeId, operandX: LiteralOperand): boolean {

        const operandNode = addressSpace.findNode(operandX.value.value as NodeId);
        if (!operandNode) {
            return false;
        }
        return sameNodeId(nodeId1, operandNode.nodeId);
    }
    for (let i = 1; i < filterOperands.length; i++) {
        const filterOperand = filterOperands[i];
        if ((filterOperand instanceof LiteralOperand) && _is(nodeId, filterOperand)) {
            return true;
        }
    }
    return false;
}

export function checkWhereClause(
    addressSpace: AddressSpace,
    sessionContext: SessionContext,
    whereClause: ContentFilter,
    eventData: IEventData
): boolean {

    if (!whereClause.elements || whereClause.elements.length === 0) {
        return true;
    }
    for (const element of whereClause.elements) {
        switch (element.filterOperator) {
            case FilterOperator.OfType:
                return checkOfType(addressSpace, element.filterOperands![0] as LiteralOperand, eventData);
            case FilterOperator.InList:
                return checkInList(addressSpace, element.filterOperands as ExtensionObject[], eventData);
            default:
                // from Spec  OPC Unified Architecture, Part 4 133 Release 1.04
                //  Any basic FilterOperator in Table 119 may be used in the whereClause, however, only the
                //  OfType_14 FilterOperator from Table 120 is permitted.
                throw new Error("Only OfType operator are allowed in checkWhereClause")
        }
    }
    return true;
}