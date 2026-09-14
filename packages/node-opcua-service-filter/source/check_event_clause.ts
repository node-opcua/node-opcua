/**
 * @module node-opcua-address-space
 */

import type { BaseNode, UAObjectType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { constructBrowsePathFromQualifiedName } from "node-opcua-service-translate-browse-path";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { SimpleAttributeOperand } from "node-opcua-types";

const debugLog = make_debugLog("check_event_clause");
const doDebug = checkDebugFlag("check_event_clause");

/**

 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
export function checkSelectClause(parentNode: BaseNode, selectClause: SimpleAttributeOperand): StatusCode {
    //
    const addressSpace = parentNode.addressSpace;

    /* c8 ignore next */
    if (selectClause.typeDefinitionId.isEmpty()) {
        return StatusCodes.Good;
    }
    const eventTypeNode = addressSpace.findEventType(selectClause.typeDefinitionId);

    // the typeDefinitionId must reference an existing node ...
    if (!eventTypeNode) {
        return StatusCodes.BadNodeIdUnknown;
    }
    // ... and that node must be an ObjectType (an EventType)
    if (eventTypeNode.nodeClass !== NodeClass.ObjectType) {
        /* c8 ignore next */
        doDebug && debugLog(" checkSelectClause", eventTypeNode.toString());
        return StatusCodes.BadTypeMismatch;
    }

    // OPC 10000-4 7.4.4.5: an empty browsePath does not mean "nothing to do" here - it denotes the
    // instance of typeDefinitionId itself (e.g. the ConditionId of an Alarms and Conditions event).
    // typeDefinitionId has already been checked above to resolve to an existing EventType, so the
    // operand is valid and must be reported Good; it is extractEventField's job, at delivery time, to
    // resolve it against the actual event instance.
    if (!selectClause.browsePath || selectClause.browsePath.length === 0) {
        return StatusCodes.Good;
    }

    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    const browsePath = constructBrowsePathFromQualifiedName(eventTypeNode, selectClause.browsePath);
    const browsePathResult = addressSpace.browsePath(browsePath);
    if (browsePathResult.statusCode.isGood()) {
        return browsePathResult.statusCode;
    }

    // OPC 10000-4 7.4.4.5: typeDefinitionId restricts the operand to instances of that type *or its
    // subtypes*, so a browsePath that does not resolve on typeDefinitionId itself is still valid as soon
    // as one subtype declares it. BaseEventType therefore acts as a wildcard: an Alarms and Conditions
    // client asks for [BranchId] or [Retain] with typeDefinitionId = BaseEventType, and those fields are
    // declared on ConditionType. Delivery already resolves per event instance (see extractEventField), so
    // only the validation had to be relaxed - and only for the clauses that did not resolve directly, so
    // the walk below never runs for a well-targeted filter.
    if (findFieldInSubtypes(eventTypeNode as UAObjectType, selectClause)) {
        return StatusCodes.Good;
    }

    // the field is declared by no subtype of typeDefinitionId either: report the original diagnostic.
    return browsePathResult.statusCode;
}

/**
 * depth-first search of the subtypes of eventTypeNode for one that declares the browsePath of selectClause.
 *
 * This is bounded by the *event type* hierarchy, not by the address space: event types are a few dozen
 * ObjectTypes even in a large server, and the search only runs when the direct resolution failed, on a
 * CreateMonitoredItems / filter validation path. It is not a per-notification cost.
 */
function findFieldInSubtypes(eventTypeNode: UAObjectType, selectClause: SimpleAttributeOperand): boolean {
    const addressSpace = eventTypeNode.addressSpace;
    const subtypes = eventTypeNode.findReferencesAsObject("HasSubtype", true);
    for (const subtype of subtypes) {
        if (subtype.nodeClass !== NodeClass.ObjectType) {
            continue;
        }
        const browsePath = constructBrowsePathFromQualifiedName(subtype, selectClause.browsePath);
        if (addressSpace.browsePath(browsePath).statusCode.isGood()) {
            return true;
        }
        if (findFieldInSubtypes(subtype as UAObjectType, selectClause)) {
            return true;
        }
    }
    return false;
}

/**

 * @param eventTypeNode
 * @param selectClauses
 * @return an array of StatusCode
 */
export function checkSelectClauses(eventTypeNode: UAObjectType, selectClauses: SimpleAttributeOperand[]): StatusCode[] {
    return selectClauses.map(checkSelectClause.bind(null, eventTypeNode));
}
