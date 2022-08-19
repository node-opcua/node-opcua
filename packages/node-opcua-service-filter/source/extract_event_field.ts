import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { SimpleAttributeOperand } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { FilterContext } from "./filter_context";
import { resolveOperand } from "./resolve_operand";

const warningLog = make_warningLog("FILTER");
const conditionTypeNodeId = resolveNodeId("ConditionType");

/**
 *
 * extract a eventField from a event node, matching the given selectClause
 */
export function extractEventField(context: FilterContext, operand: SimpleAttributeOperand): Variant {
    assert(operand instanceof SimpleAttributeOperand);

    operand.browsePath = operand.browsePath || [];

    if (operand.browsePath.length === 0 && operand.attributeId === AttributeIds.NodeId) {
        // "ns=0;i=2782" => ConditionType
        // "ns=0;i=2041" => BaseEventType
        if (!sameNodeId(operand.typeDefinitionId, conditionTypeNodeId)) {
            // not a ConditionType
            // but could be on of its derived type. for instance ns=0;i=2881 => AcknowledgeableConditionType
            if (!context.isSubtypeOf(operand.typeDefinitionId, conditionTypeNodeId)) {
                warningLog(" ", operand.typeDefinitionId.toString());
                warningLog("this case is not handled yet : selectClause.typeDefinitionId = " + operand.typeDefinitionId.toString());
                warningLog(operand.toString());
                return new Variant({ dataType: DataType.NodeId, value: context.eventSource });
            }
        }

        const eventSourceTypeDefinition = context.getTypeDefinition(context.eventSource);
        if (!eventSourceTypeDefinition) {
            // eventSource is a EventType class
            return new Variant();
        }

        if (!context.isSubtypeOf(eventSourceTypeDefinition, conditionTypeNodeId)) {
            return new Variant();
        }
        // Yeh : our EventType is a Condition Type !
        return new Variant({ dataType: DataType.NodeId, value: context.eventSource });
    }
    return resolveOperand(context, operand);
}

export function extractEventFieldsBase(context: FilterContext, selectClauses: SimpleAttributeOperand[]): Variant[] {
    assert(Array.isArray(selectClauses));
    assert(selectClauses.length === 0 || selectClauses[0] instanceof SimpleAttributeOperand);
    return selectClauses.map(extractEventField.bind(null, context));
}
