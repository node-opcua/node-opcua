"use strict";
/**
 * @module opcua.miscellaneous
 * @class ToolBrowsePath
 *
 * @static
 */

var BrowsePath = require("../_generated_/_auto_generated_BrowsePath").BrowsePath;

var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var ReferenceTypeIds = require("node-opcua-constants").ReferenceTypeIds;
var hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);


exports.stringToQualifiedName = require("node-opcua-data-model").stringToQualifiedName;

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

