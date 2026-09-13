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
    return browsePathResult.statusCode;
}

/**

 * @param eventTypeNode
 * @param selectClauses
 * @return an array of StatusCode
 */
export function checkSelectClauses(eventTypeNode: UAObjectType, selectClauses: SimpleAttributeOperand[]): StatusCode[] {
    return selectClauses.map(checkSelectClause.bind(null, eventTypeNode));
}
