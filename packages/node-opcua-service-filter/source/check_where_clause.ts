import {
    ContentFilter,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand,
    FilterOperand,
    AttributeOperand,
    ElementOperand
} from "node-opcua-types";
import { ExtensionObject } from "node-opcua-extension-object";
import { DataType, Variant } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { make_warningLog } from "node-opcua-debug";
//
import { FilterContext } from "./filter_context";
import { resolveOperand } from "./resolve_operand";

const warningLog = make_warningLog("Filter");

function _coerceToBoolean(value: Variant | string| number | null ): boolean {
    if (value instanceof Variant) {
        return !!value.value;
    }
    return !!value;
}
function _coerceToCompareable(value: Variant): string | number {
    if (value instanceof Variant) {
        switch (value.dataType) {
            case DataType.String:
                return value.value;
            case DataType.Byte:
            case DataType.SByte:
            case DataType.Int16:
            case DataType.Int32:
            case DataType.UInt16:
            case DataType.UInt32:
                return value.value;
            case DataType.Double:
                return value.value;
            case DataType.DateTime:
                return value.value.getTime();
            case DataType.Guid:
                return value.value.toLowerCase();
            case DataType.ByteString:
                return value.value.toString("hex");
            case DataType.XmlElement:
                return value.value;
            case DataType.LocalizedText:
                return value.value.text;
            case DataType.QualifiedName:
                return value.value.name; // not sure about this one
            default:
                return "";
        }
    }
    return "";
}

function _coerceToEqualable(value: Variant): Variant {
    return value;
}
function evaluateOperand<T>(
    filterContext: FilterContext,
    filter: ContentFilter,
    operand: FilterOperand,
    coerce: (value: any) => T
): T {
    if (operand instanceof AttributeOperand) {
        return coerce(resolveOperand(filterContext, operand));
    } else if (operand instanceof SimpleAttributeOperand) {
        return coerce(resolveOperand(filterContext, operand));
    } else if (operand instanceof LiteralOperand) {
        return coerce(operand.value);
    } else if (operand instanceof ElementOperand) {
        const index = operand.index;
        return coerce(checkFilterAtIndex(filterContext, filter, index));
    }
    // istanbul ignore
    return coerce(null);
}

function checkOfType(filterContext: FilterContext, ofType: ExtensionObject | null): boolean {
    // istanbul ignore next
    if (!ofType || !(ofType instanceof LiteralOperand)) {
        warningLog("checkOfType : unsupported case ! ofType is not a LiteralOperand , ofType = ", ofType?.toString());
        return false;
    }
    // istanbul ignore next
    if (ofType.value.dataType !== DataType.NodeId) {
        warningLog("invalid operand type (expecting NodeId); got " + DataType[ofType.value.dataType]);
        return false;
    }

    const ofTypeNode: NodeId = ofType.value.value;
    // istanbul ignore next
    if (!ofTypeNode) {
        return false; // the ofType node is not known, we don't know what to do
    }
    const ofTypeNodeNodeClass = filterContext.getNodeClass(ofTypeNode);

    // istanbul ignore next
    if (
        ofTypeNodeNodeClass !== NodeClass.ObjectType &&
        ofTypeNodeNodeClass !== NodeClass.VariableType &&
        ofTypeNodeNodeClass !== NodeClass.DataType &&
        ofTypeNodeNodeClass !== NodeClass.ReferenceType
    ) {
        warningLog("operand should be a ObjectType " + ofTypeNode.toString());
        return false;
    }

    if (!filterContext.eventSource || filterContext.eventSource.isEmpty()) {
        return false;
    }

    let sourceTypeDefinition = filterContext.eventSource;
    const sourceNodeClass = filterContext.getNodeClass(filterContext.eventSource);
    if (sourceNodeClass === NodeClass.Object || sourceNodeClass === NodeClass.Variable) {
        sourceTypeDefinition = filterContext.getTypeDefinition(filterContext.eventSource)!;
        if (!sourceTypeDefinition) {
            return false;
        }
    }
    return filterContext.isSubtypeOf(sourceTypeDefinition, ofTypeNode);
}

function checkNot(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToBoolean);
    return !operandA;
}

function checkOr(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToBoolean);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToBoolean);
    return operandA || operandB;
}
/**
 *
 * TRUE if operand[0] and operand[1] are TRUE.
 * The following restrictions apply to the operands:
 *  [0]: Any operand that resolves to a Boolean.
 *
 *   [1]: Any operand that resolves to a Boolean.
 * If any operand cannot be resolved to a Boolean it is considered a NULL. See below for a discussion on the handling of NULL.
 */
function checkAnd(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToBoolean);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToBoolean);
    return operandA && operandB;
}
function checkLessThan(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToCompareable);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToCompareable);
    return operandA < operandB;
}

function checkLessThanOrEqual(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToCompareable);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToCompareable);
    return operandA <= operandB;
}

function checkGreaterThan(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToCompareable);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToCompareable);
    return operandA > operandB;
}

function checkGreaterThanOrEqual(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToCompareable);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToCompareable);
    return operandA >= operandB;
}

const isVariantEqual = (a: Variant, b: Variant): boolean => {

    switch (a.dataType) {
        case DataType.Null:
            return b.dataType === DataType.Null;
        case DataType.Boolean:
            return a.value === b.value;
        case DataType.Byte:
        case DataType.SByte:
        case DataType.Int16:
        case DataType.Int32:
        case DataType.UInt16:
        case DataType.UInt32:
            return a.value === b.value;
        case DataType.Double:
            return a.value === b.value;
        case DataType.String:
            return a.value === b.value;
        case DataType.NodeId:
            return sameNodeId(a.value as NodeId, b.value as NodeId);
        case DataType.DateTime:
            return (a.value as Date)?.getTime() === (b.value as Date).getTime();
        case DataType.Guid:
            return a.value.toLowerCase() === ("" + (b.value || "")).toLowerCase();
        case DataType.ByteString:
            if (b.dataType !== DataType.ByteString) {
                return false;
            }
            return a.value.toString("hex") === b.value.toString("hex");
        case DataType.XmlElement:
            return a.value === b.value;
        case DataType.LocalizedText:
            return a.value?.text === b.value?.text;
        case DataType.QualifiedName:
            return a.value?.namespaceIndex === b.value?.namespaceIndex && a.value?.name === b.value?.name;
        case DataType.ExtensionObject:
            console.log("isVariantEqual: Not implemented for DataType.ExtensionObject");
        default:
            return false; // not sure how to do
    }
}

function checkEquals(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToEqualable);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToEqualable);
    return isVariantEqual(operandA, operandB);
}
/**
 *
 * TRUE if operand[0] is greater or equal to operand[1] and less than or equal to operand[2].
 * The following restrictions apply to the operands:
 *   [0]: Any operand that resolves to an ordered value.
 *   [1]: Any operand that resolves to an ordered value.
 *   [2]: Any operand that resolves to an ordered value.
 * If the operands are of different types, the system shall perform any implicit conversion to match
 * all operands to a common type. If no implicit conversion is available and the operands are of different
 * types, the particular result is FALSE. See the discussion on data type precedence in Table 123
 * for more information how to convert operands of different types.
 */
function checkBetween(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToCompareable);
    const operandLow = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToCompareable);
    const operandHigh = evaluateOperand(filterContext, filter, filteredOperands[2], _coerceToCompareable);
    return operandA >= operandLow && operandA <= operandHigh;
}

/**
 * 
 * InList
 * TRUE if operand[0] is equal to one or more of the remaining operands.
 * The Equals Operator is evaluated for operand[0] and each remaining operand in the
 * list. If any Equals evaluation is TRUE, InList returns TRUE
 x*/
function checkInList(context: FilterContext, filterOperands: FilterOperand[]): boolean {
    const operand0 = filterOperands[0];

    // istanbul ignore next
    if (!(operand0 instanceof SimpleAttributeOperand)) {
        // unsupported case
        warningLog("FilterOperator.InList operand0 is not a SimpleAttributeOperand " + operand0.constructor.name);
        return false;
    }
    const value = resolveOperand(context, operand0);

    // istanbul ignore next
    if (value.dataType !== DataType.NodeId) {
        return false;
    }

    const nodeId: NodeId | null = value.value as NodeId;

    // istanbul ignore next
    if (!nodeId) {
        return false;
    }

    function _is(nodeId1: NodeId, operandX: LiteralOperand): boolean {
        if (operandX.value.dataType !== DataType.NodeId) {
            return false;
        }
        const nodeId2 = operandX.value.value as NodeId;
        const nodeClass = context.getNodeClass(nodeId2);
        if (nodeClass === NodeClass.Unspecified) {
            return false;
        }
        return sameNodeId(nodeId1, nodeId2);
    }

    for (let i = 1; i < filterOperands.length; i++) {
        const filterOperand = filterOperands[i];
        if (filterOperand instanceof LiteralOperand && _is(nodeId, filterOperand)) {
            return true;
        }
    }
    return false;
}

// eslint-disable-next-line complexity
function checkFilterAtIndex(filterContext: FilterContext, filter: ContentFilter, index: number): boolean {
    if (!filter.elements || filter.elements.length === 0) {
        return true;
    }
    const element = filter.elements[index];

    // istanbul ignore next
    if (!element) {
        return true;
    }
    const filterOperands = (element.filterOperands as FilterOperand[] | null) || [];

    switch (element.filterOperator) {
        case FilterOperator.Equals:
            return checkEquals(filterContext, filter, filterOperands);
        case FilterOperator.LessThan:
            return checkLessThan(filterContext, filter, filterOperands);
        case FilterOperator.LessThanOrEqual:
            return checkLessThanOrEqual(filterContext, filter, filterOperands);
        case FilterOperator.GreaterThan:
            return checkGreaterThan(filterContext, filter, filterOperands);
        case FilterOperator.GreaterThanOrEqual:
            return checkGreaterThanOrEqual(filterContext, filter, filterOperands);
        case FilterOperator.Between:
            return checkBetween(filterContext, filter, filterOperands);

        case FilterOperator.And:
            return checkAnd(filterContext, filter, filterOperands);
        case FilterOperator.Or:
            return checkOr(filterContext, filter, filterOperands);
        case FilterOperator.Not:
            return checkNot(filterContext, filter, filterOperands);

        case FilterOperator.OfType:
            return checkOfType(filterContext, element.filterOperands![0]);
        case FilterOperator.InList:
            return checkInList(filterContext, filterOperands);

        case FilterOperator.RelatedTo:
        case FilterOperator.Like:
        case FilterOperator.BitwiseAnd:
        case FilterOperator.BitwiseOr:
        case FilterOperator.Cast:
        case FilterOperator.InView:
        case FilterOperator.IsNull:
        default:
            // from Spec  OPC Unified Architecture, Part 4 133 Release 1.04
            //  Any basic FilterOperator in Table 119 may be used in the whereClause, however, only the
            //  OfType_14 FilterOperator from Table 120 is permitted.
            warningLog(`checkFilter: operator ${FilterOperator[element.filterOperator]} is currently not supported in filter`);
            return false;
    }
}

export function checkFilter(filterContext: FilterContext, contentFilter: ContentFilter): boolean {
    return checkFilterAtIndex(filterContext, contentFilter, 0);
}
