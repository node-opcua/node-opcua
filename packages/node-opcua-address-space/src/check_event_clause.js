"use strict";
const assert = require("node-opcua-assert").assert;

const UAObjectType = require("./ua_object_type").UAObjectType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const constructBrowsePathFromQualifiedName = require("node-opcua-service-translate-browse-path").constructBrowsePathFromQualifiedName;

/**
 * @method checkSelectClause
 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
function checkSelectClause(parentNode, selectClause) {
    // SimpleAttributeOperand
    const addressSpace = parentNode.addressSpace;

    if (selectClause.typeId.isEmpty()) {
        return StatusCodes.Good;
    }
    const eventTypeNode =  addressSpace.findEventType(selectClause.typeId);

    if (!eventTypeNode || !(eventTypeNode instanceof UAObjectType)) {
        //xx console.log("eventTypeNode = ",selectClause.typeId.toString());
        //xx console.log("eventTypeNode = ",eventTypeNode);
        if (eventTypeNode) { console.log(eventTypeNode.toString()); }
    }

    assert(eventTypeNode instanceof UAObjectType);
    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    const browsePath = constructBrowsePathFromQualifiedName(eventTypeNode, selectClause.browsePath);
    const browsePathResult = addressSpace.browsePath(browsePath);
    return browsePathResult.statusCode;

}
exports.checkSelectClause = checkSelectClause;
/**
 * @method checkSelectClauses
 * @param eventTypeNode
 * @param selectClauses {selectClauseResults}
 * @return {StatusCodes<>}
 */
function checkSelectClauses(eventTypeNode, selectClauses) {
    return selectClauses.map(checkSelectClause.bind(null, eventTypeNode));
}
exports.checkSelectClauses = checkSelectClauses;


