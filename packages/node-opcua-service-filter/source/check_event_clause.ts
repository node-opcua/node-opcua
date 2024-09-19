/**
 * @module node-opcua-address-space
 */
import { NodeClass } from "node-opcua-data-model";
import { SimpleAttributeOperand } from "node-opcua-types";
import { constructBrowsePathFromQualifiedName } from "node-opcua-service-translate-browse-path";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { BaseNode, UAObjectType } from "node-opcua-address-space-base";
import { make_debugLog } from "node-opcua-debug";

const debugLog = make_debugLog(__filename);

/**

 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
export function checkSelectClause(parentNode: BaseNode, selectClause: SimpleAttributeOperand): StatusCode {
    //
    const addressSpace = parentNode.addressSpace;

    // istanbul ignore next
    if (selectClause.typeDefinitionId.isEmpty()) {
        return StatusCodes.Good;
    }
    const eventTypeNode = addressSpace.findEventType(selectClause.typeDefinitionId)!;

    if (!eventTypeNode || !(eventTypeNode.nodeClass === NodeClass.ObjectType)) {
        // istanbul ignore next
        if (eventTypeNode) {
            debugLog(" checkSelectClause", eventTypeNode.toString());
        }
    }

    // istanbul ignore next
    if (eventTypeNode.nodeClass !== NodeClass.ObjectType) {
        return StatusCodes.BadTypeMismatch;
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
