/**
 * @module node-opcua-service-translate-browse-path
 * @class ToolBrowsePath
 * @static
 */
import { ReferenceTypeIds } from "node-opcua-constants";
import { makeNodeId, NodeId } from "node-opcua-nodeid";
import { BrowsePath } from "./imports";

const hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);
export { stringToQualifiedName } from "node-opcua-data-model";

/**
 * @method constructBrowsePathFromQualifiedName
 * @param startingNode
 * @param targetNames
 * @return {BrowsePath}
 */
export function constructBrowsePathFromQualifiedName(
  startingNode: { nodeId: NodeId },
  targetNames: null | string[]
): BrowsePath {

    targetNames = targetNames || [];

    const elements = targetNames.map((targetName) => {
        return {
            isInverse: false,

            includeSubtypes: true,

            referenceTypeId: hierarchicalReferencesId,
            targetName
        };
    });

    const browsePath = new BrowsePath({
        startingNode: startingNode.nodeId, // ROOT

        relativePath: { elements }
    });
    return browsePath;
}
