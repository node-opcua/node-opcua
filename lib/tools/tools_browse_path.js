/**
 * @module opcua.miscellaneous
 * @class ToolBrowsePath
 *
 * @static
 */
import assert from "better-assert";
import { 
  BrowsePathResult,
  BrowsePath 
} from "lib/services/translate_browse_paths_to_node_ids_service";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { makeNodeId } from "lib/datamodel/nodeid";
import { ReferenceTypeIds } from "lib/opcua_node_ids";

import { stringToQualifiedName } from "lib/datamodel/qualified_name";

const hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);

/**
 * @method constructBrowsePathFromQualifiedName
 * @param startingNode
 * @param browsePath
 * @return {number|*|BrowsePath}
 */
function constructBrowsePathFromQualifiedName(startingNode, browsePath = []) {  
  return new BrowsePath({
    startingNode: startingNode.nodeId, // ROOT
    relativePath: {
      elements: browsePath.map(targetName => ({
        referenceTypeId: hierarchicalReferencesId,
        isInverse: false,
        includeSubtypes: true,
        targetName
      }))
    }
  });
}
export {
  constructBrowsePathFromQualifiedName,
  stringToQualifiedName
};

