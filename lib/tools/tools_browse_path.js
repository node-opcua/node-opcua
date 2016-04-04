"use strict";
/**
 * @module opcua.miscellaneous
 * @class ToolBrowsePath
 *
 * @static
 */
require("requirish")._(module);
var assert = require("better-assert");
var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePathResult = translate_service.BrowsePathResult;
var BrowsePath = translate_service.BrowsePath;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
var hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);


exports.stringToQualifiedName = require("lib/datamodel/qualified_name").stringToQualifiedName;

/**
 * @method constructBrowsePathFromQualifiedName
 * @param startingNode
 * @param browsePath
 * @return {number|*|BrowsePath}
 */
function constructBrowsePathFromQualifiedName(startingNode, browsePath) {

    browsePath = browsePath || [];
    
    var elements = browsePath.map(function (targetName) {
        return {
            referenceTypeId: hierarchicalReferencesId,
            isInverse: false,
            includeSubtypes: true,
            targetName: targetName
        };
    });

    browsePath = new BrowsePath({
        startingNode: startingNode.nodeId, // ROOT
        relativePath: {
            elements: elements
        }
    });
    return browsePath;
}
exports.constructBrowsePathFromQualifiedName = constructBrowsePathFromQualifiedName;

