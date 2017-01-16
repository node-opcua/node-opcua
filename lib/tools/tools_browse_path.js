/**
 * @module opcua.miscellaneous
 * @class ToolBrowsePath
 *
 * @static
 */
require("requirish")._(module);
const assert = require("better-assert");
const translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
const BrowsePathResult = translate_service.BrowsePathResult;
const BrowsePath = translate_service.BrowsePath;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
const ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
const hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);


exports.stringToQualifiedName = require("lib/datamodel/qualified_name").stringToQualifiedName;

/**
 * @method constructBrowsePathFromQualifiedName
 * @param startingNode
 * @param browsePath
 * @return {number|*|BrowsePath}
 */
function constructBrowsePathFromQualifiedName(startingNode, browsePath) {

    browsePath = browsePath || [];
    
    const elements = browsePath.map(targetName => ({
        referenceTypeId: hierarchicalReferencesId,
        isInverse: false,
        includeSubtypes: true,
        targetName
    }));

    browsePath = new BrowsePath({
        startingNode: startingNode.nodeId, // ROOT
        relativePath: {
            elements
        }
    });
    return browsePath;
}
exports.constructBrowsePathFromQualifiedName = constructBrowsePathFromQualifiedName;

