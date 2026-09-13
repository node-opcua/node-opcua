import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { constructBrowsePathFromQualifiedName } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { AttributeOperand, SimpleAttributeOperand } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import type { FilterContext } from "./filter_context.js";

const warningLog = make_warningLog("FILTER");
const debugLog = make_debugLog("FILTER");
const doDebug = checkDebugFlag("FILTER");
const conditionTypeNodeId = resolveNodeId("ConditionType");

/**
 * OPC 10000-4 7.4.4.5: a SimpleAttributeOperand with an empty browsePath denotes the instance of
 * typeDefinitionId itself, not "nothing to do". A ConditionId operand (typeDefinitionId
 * ConditionType or a subtype, attributeId NodeId, empty browsePath) resolves to the event's own
 * condition instance NodeId - this is what every Alarms and Conditions client sends, in both the
 * select clause (delivery, via extractEventField) and the where clause (evaluation, via
 * resolveOperand below). FEAT-58 taught the select-clause validation this; both consumers share
 * this one resolution so they never drift apart again.
 *
 * Returns undefined when the operand does not match this shape, so the caller falls back to its
 * normal browsePath resolution.
 */
export function resolveConditionIdOperand(context: FilterContext, operand: SimpleAttributeOperand): Variant | undefined {
    if (operand.browsePath && operand.browsePath.length > 0) {
        return undefined;
    }
    if (operand.attributeId !== AttributeIds.NodeId) {
        return undefined;
    }
    // "ns=0;i=2782" => ConditionType
    // "ns=0;i=2041" => BaseEventType
    if (!sameNodeId(operand.typeDefinitionId, conditionTypeNodeId)) {
        // not a ConditionType
        // but could be on of its derived type. for instance ns=0;i=2881 => AcknowledgeableConditionType
        if (!context.isSubtypeOf(operand.typeDefinitionId, conditionTypeNodeId)) {
            warningLog(" ", operand.typeDefinitionId.toString());
            warningLog(`this case is not handled yet : selectClause.typeDefinitionId = ${operand.typeDefinitionId.toString()}`);
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

// export function readOperand(context: FilterContext, operand: SimpleAttributeOperand): Variant {
//     // navigate to the innerNode specified by the browsePath [ QualifiedName]
//     const browsePath = constructBrowsePathFromQualifiedName({ nodeId: context.eventSource }, operand.browsePath);
//     const targetNode = context.browsePath(browsePath);
//     if (!targetNode) {
//         return new Variant({ dataType: DataType.Null });
//     }
//     return context.readNodeValue(targetNode);
// }

export function resolveOperand(context: FilterContext, operand: SimpleAttributeOperand | AttributeOperand): Variant {
    if (operand instanceof SimpleAttributeOperand) {
        const conditionIdValue = resolveConditionIdOperand(context, operand);
        if (conditionIdValue) {
            return conditionIdValue;
        }

        const browsePath = constructBrowsePathFromQualifiedName({ nodeId: context.eventSource }, operand.browsePath);

        const target: NodeId | null = context.browsePath(browsePath);
        if (!target) {
            return new Variant({ dataType: DataType.Null });
            // return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeIdUnknown });
        }
        const nodeClass = context.getNodeClass(target);
        if (nodeClass !== NodeClass.Variable) {
            doDebug &&
                debugLog(
                    "resolveOperand: cannot find variable here but got nodeClass",
                    NodeClass[nodeClass],
                    browsePath.toString()
                );
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeClassInvalid });
        }
        const value = context.readNodeValue(target);
        return value;
    } else {
        if (!(operand instanceof AttributeOperand)) {
            throw new Error("expecting an AttributeOperand");
        }
        warningLog("AttributeOperand is not yet implemented");
        return new Variant({ dataType: DataType.Null });
    }
}
