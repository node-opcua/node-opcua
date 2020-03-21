import {
    SessionContext,
    IEventData,
    AddressSpace
} from "../../source";
import {
    ContentFilter, FilterOperator, LiteralOperand
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";

import { UAObjectType } from "../ua_object_type";
import { UAReferenceType } from "../ua_reference_type";
import { UAVariableType } from "../ua_variable_type";

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
    const node = eventData.$eventDataSource! as (UAObjectType | UAReferenceType | UAVariableType);
    if (!node) {
        throw new Error("cannot find  node " + eventData.$eventDataSource?.toString());
    }
    return (node as any).isSupertypeOf(ofTypeNode);
    //    return true;
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
            default:
                // from Spec  OPC Unified Architecture, Part 4 133 Release 1.04
                //  Any basic FilterOperator in Table 119 may be used in the whereClause, however, only the
                //  OfType_14 FilterOperator from Table 120 is permitted.
                throw new Error("Only OfType operator are allowed in checkWhereClause")
        }
    }
    return true;
}