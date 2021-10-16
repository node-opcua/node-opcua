import {
    ContentFilter,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand,
    FilterOperand,
    ElementOperand
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import {
    IAddressSpace,
    IEventData,
    ISessionContext,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariableType
} from "node-opcua-address-space-base";

import { SessionContext } from "../../source/session_context";
import { extractEventFields } from "./extract_event_fields";

function checkNot(
    addressSpace: IAddressSpace,
    sessionContext: ISessionContext,
    whereClause: ContentFilter,
    eventData: IEventData,
    filteredOperands: FilterOperand[]
): boolean {
    if (filteredOperands[0] instanceof ElementOperand) {
        const index = (filteredOperands[0] as ElementOperand).index;
        return !__checkWhereClause(addressSpace, sessionContext, whereClause, index, eventData);
    }
    return false;
}

function checkOfType(addressSpace: IAddressSpace, ofType: LiteralOperand, eventData: IEventData): boolean {
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
        throw new Error("operand should be a ObjectType " + ofTypeNode.nodeId.toString());
    }
    const node = eventData.$eventDataSource! as UAObjectType | UAObject | UAReferenceType | UAVariableType;
    if (!node) {
        throw new Error("cannot find  node " + eventData.$eventDataSource?.toString());
    }
    if (node.nodeClass === NodeClass.ObjectType) {
        return node.isSupertypeOf(ofTypeNode);
    }
    if (node.nodeClass === NodeClass.Object && node.typeDefinitionObj) {
        return node.typeDefinitionObj.isSupertypeOf(ofTypeNode);
    }
    return true;
}

function _extractValue(operand: SimpleAttributeOperand, eventData: IEventData): NodeId | null {
    // eventData.readValue;
    const v = extractEventFields(SessionContext.defaultContext, [operand], eventData)[0];
    return v.value as NodeId;
}

function checkInList(addressSpace: IAddressSpace, filterOperands: ExtensionObject[], eventData: IEventData): boolean {
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
        if (filterOperand instanceof LiteralOperand && _is(nodeId, filterOperand)) {
            return true;
        }
    }
    return false;
}

export function __checkWhereClause(
    addressSpace: IAddressSpace,
    sessionContext: ISessionContext,
    whereClause: ContentFilter,
    index: number,
    eventData: IEventData
): boolean {
    if (!whereClause.elements || whereClause.elements.length === 0) {
        return true;
    }
    const element = whereClause.elements[index];
    if (!element) {
        return true;
    }
    switch (element.filterOperator) {
        case FilterOperator.Not:
            return checkNot(addressSpace, sessionContext, whereClause, eventData, element.filterOperands as FilterOperand[]);
        case FilterOperator.OfType:
            return checkOfType(addressSpace, element.filterOperands![0] as LiteralOperand, eventData);
        case FilterOperator.InList:
            return checkInList(addressSpace, element.filterOperands as ExtensionObject[], eventData);
        default:
            // from Spec  OPC Unified Architecture, Part 4 133 Release 1.04
            //  Any basic FilterOperator in Table 119 may be used in the whereClause, however, only the
            //  OfType_14 FilterOperator from Table 120 is permitted.
            // tslint:disable-next-line: no-console
            console.log("whereClause = ", whereClause.toString());
            throw new Error("Only OfType operator are allowed in checkWhereClause");
    }
}

export function checkWhereClause(
    addressSpace: IAddressSpace,
    sessionContext: ISessionContext,
    whereClause: ContentFilter,
    eventData: IEventData
): boolean {
    if (!whereClause.elements || whereClause.elements.length === 0) {
        return true;
    }
    return __checkWhereClause(addressSpace, sessionContext, whereClause, 0, eventData);
}
