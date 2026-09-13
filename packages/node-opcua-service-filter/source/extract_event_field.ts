import { assert } from "node-opcua-assert";
import { SimpleAttributeOperand } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { FilterContext } from "./filter_context.js";
import { resolveConditionIdOperand, resolveOperand } from "./resolve_operand.js";

/**
 *
 * extract a eventField from a event node, matching the given selectClause
 */
export function extractEventField(context: FilterContext, operand: SimpleAttributeOperand): Variant {
    assert(operand instanceof SimpleAttributeOperand);

    operand.browsePath = operand.browsePath || [];

    // the ConditionId shape (empty browsePath, attributeId NodeId) is resolved the same way here
    // (delivery) and in resolveOperand (where-clause evaluation) - see resolveConditionIdOperand.
    const conditionIdValue = resolveConditionIdOperand(context, operand);
    if (conditionIdValue) {
        return conditionIdValue;
    }
    return resolveOperand(context, operand);
}

export function extractEventFieldsBase(context: FilterContext, selectClauses: SimpleAttributeOperand[]): Variant[] {
    assert(Array.isArray(selectClauses));
    assert(selectClauses.length === 0 || selectClauses[0] instanceof SimpleAttributeOperand);
    return selectClauses.map(extractEventField.bind(null, context));
}
