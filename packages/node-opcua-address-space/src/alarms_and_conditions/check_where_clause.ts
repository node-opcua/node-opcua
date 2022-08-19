import {
    ContentFilter,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand,
    FilterOperand,
    AttributeOperand,
    ElementOperand
} from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import {
    BaseNode,
    IAddressSpace,
    IEventData,
    ISessionContext,
    UADataType,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { make_warningLog } from "node-opcua-debug";

import { resolveOperand } from "./resolve_operand";
import { extractEventFields } from "./extract_event_fields";

const warningLog = make_warningLog("Filter");

export interface FilterContext {
    addressSpace: IAddressSpace;
    sessionContext: ISessionContext;
    rootNode: BaseNode;
    extractValue?(operatand: SimpleAttributeOperand | AttributeOperand): Variant;
}
function _coerceToBoolean(value: Variant | number | string | null | boolean): boolean {
    if (value instanceof Variant) {
        return _coerceToBoolean(value.value);
    }
    return !!value;
}
function _coerceToNumber(value: Variant | number | string | null | boolean): number {
    if (value instanceof Variant) {
        return _coerceToNumber(value.value);
    }
    if (typeof value === "string") {
        return parseInt(value, 10);
    }
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return 0;
}

function evaluateOperand<T>(
    filterContext: FilterContext,
    filter: ContentFilter,
    operand: FilterOperand,
    coerce: (value: any) => T
): T {
    if (operand instanceof AttributeOperand) {
        return coerce(extractValue(filterContext, operand));
    } else if (operand instanceof SimpleAttributeOperand) {
        return coerce(extractValue(filterContext, operand));
    } else if (operand instanceof LiteralOperand) {
        return coerce(operand.value);
    } else if (operand instanceof ElementOperand) {
        const index = operand.index;
        return coerce(checkFilterAtIndex(filterContext, filter, index));
    }
    // istanbul ignore
    return coerce(null);
}

// eslint-disable-next-line complexity
function checkOfType(filterContext: FilterContext, ofType: LiteralOperand | undefined): boolean {
    // istanbul ignore next
    if (!ofType) {
        throw new Error("invalid operand");
    }
    // istanbul ignore next
    if (ofType.value.dataType !== DataType.NodeId) {
        throw new Error("invalid operand type (expecting NodeId); got " + DataType[ofType.value.dataType]);
    }

    const ofTypeNode = filterContext.addressSpace.findNode(ofType.value.value);

    // istanbul ignore next
    if (!ofTypeNode) {
        return false; // the ofType node is not known, we don't know what to do
    }

    // istanbul ignore next
    if (
        ofTypeNode.nodeClass !== NodeClass.ObjectType &&
        ofTypeNode.nodeClass !== NodeClass.VariableType &&
        ofTypeNode.nodeClass !== NodeClass.DataType &&
        ofTypeNode.nodeClass !== NodeClass.ReferenceType
    ) {
        throw new Error("operand should be a ObjectType " + ofTypeNode.nodeId.toString());
    }
    const node = filterContext.rootNode;

    if (!node) {
        warningLog("invalid filterContext.rootNode - must be specifed ");
        return false;
    }

    if (node.nodeClass === NodeClass.ObjectType) {
        if (ofTypeNode.nodeClass !== NodeClass.ObjectType) return false;
        return (node as UAObjectType).isSupertypeOf(ofTypeNode as UAObjectType);
    }
    if (node.nodeClass === NodeClass.VariableType) {
        if (ofTypeNode.nodeClass !== NodeClass.VariableType) return false;
        return (node as UAVariableType).isSupertypeOf(ofTypeNode as UAVariableType);
    }
    if (node.nodeClass === NodeClass.ReferenceType) {
        if (ofTypeNode.nodeClass !== NodeClass.ReferenceType) return false;
        return (node as UAReferenceType).isSupertypeOf(ofTypeNode as UAReferenceType);
    }
    if (node.nodeClass === NodeClass.DataType) {
        if (ofTypeNode.nodeClass !== NodeClass.DataType) return false;
        return (node as UADataType).isSupertypeOf(ofTypeNode as UADataType);
    }
    if (node.nodeClass === NodeClass.Object) {
        if (ofTypeNode.nodeClass !== NodeClass.ObjectType) return false;
        const obj = node as UAObject;
        return obj.typeDefinitionObj.isSupertypeOf(ofTypeNode as UAObjectType);
    }
    if (node.nodeClass === NodeClass.Variable) {
        if (ofTypeNode.nodeClass !== NodeClass.VariableType) return false;
        const obj = node as UAVariable;
        return obj.typeDefinitionObj.isSupertypeOf(ofTypeNode as UAVariableType);
    }
    return false;
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
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    return operandA < operandB;
}

function checkLessThanOrEqual(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    return operandA <= operandB;
}

function checkGreaterThan(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    return operandA > operandB;
}

function checkGreaterThanOrEqual(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    return operandA >= operandB;
}
function checkEquals(filterContext: FilterContext, filter: ContentFilter, filteredOperands: FilterOperand[]): boolean {
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandB = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    return operandA === operandB;
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
    const operandA = evaluateOperand(filterContext, filter, filteredOperands[0], _coerceToNumber);
    const operandLow = evaluateOperand(filterContext, filter, filteredOperands[1], _coerceToNumber);
    const operandHigh = evaluateOperand(filterContext, filter, filteredOperands[2], _coerceToNumber);
    return operandA >= operandLow && operandA <= operandHigh;
}

function checkInList(filterContext: FilterContext, filterOperands: FilterOperand[]): boolean {
    const operand0 = filterOperands[0];

    // istanbul ignore next
    if (!(operand0 instanceof SimpleAttributeOperand)) {
        // unsupported case
        warningLog("FilterOperator.InList operand0 is not a SimpleAttributeOperand " + operand0.constructor.name);
        return false;
    }
    const value = extractValue(filterContext, operand0);

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
        const operandNode = filterContext.addressSpace.findNode(operandX.value.value as NodeId);

        // istanbul ignore next
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
            return checkOfType(filterContext, element.filterOperands![0] as LiteralOperand);
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

export function checkWhereClause(
    addressSpace: IAddressSpace,
    sessionContext: ISessionContext,
    whereClause: ContentFilter,
    eventData: IEventData
): boolean {
    const filterContext: FilterContext = {
        addressSpace,
        sessionContext,
        rootNode: eventData.$eventDataSource!,
        extractValue(operand: FilterOperand) {
            if (operand instanceof SimpleAttributeOperand) {
                return extractEventFields(filterContext.sessionContext, [operand], eventData)[0];
            } else {
                return new Variant({ dataType: DataType.Null });
            }
        }
    };
    return checkFilter(filterContext, whereClause);
}

export function extractValue(filterContext: FilterContext, operand: SimpleAttributeOperand | AttributeOperand): Variant {
    if (filterContext.extractValue) {
        return filterContext.extractValue(operand);
    }
    return resolveOperand(filterContext.addressSpace, filterContext.rootNode, operand);
}
