"use strict";
var assert = require("node-opcua-assert");

var UAObjectType = require("./ua_object_type").UAObjectType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var constructBrowsePathFromQualifiedName = require("node-opcua-service-translate-browse-path").constructBrowsePathFromQualifiedName;

/**
 * @method checkSelectClause
 * @param parentNode
 * @param selectClause
 * @return {Array<StatusCode>}
 */
function checkSelectClause(parentNode, selectClause) {
    // SimpleAttributeOperand
    var addressSpace = parentNode.addressSpace;

    if (selectClause.typeId.isEmpty()) {
        return StatusCodes.Good;
    }
    var eventTypeNode =  addressSpace.findEventType(selectClause.typeId);

    if (!eventTypeNode || !(eventTypeNode instanceof UAObjectType)) {
        //xx console.log("eventTypeNode = ",selectClause.typeId.toString());
        //xx console.log("eventTypeNode = ",eventTypeNode);
        if (eventTypeNode) { console.log(eventTypeNode.toString()); }
    }

    assert(eventTypeNode instanceof UAObjectType);
    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    var browsePath = constructBrowsePathFromQualifiedName(eventTypeNode, selectClause.browsePath);
    var browsePathResult = addressSpace.browsePath(browsePath);
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


