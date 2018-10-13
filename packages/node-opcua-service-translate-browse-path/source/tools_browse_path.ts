/**
 * @module opcua.miscellaneous
 * @class ToolBrowsePath
 *
 * @static
 */
import { BrowsePath } from "./imports";
import { makeNodeId, NodeId } from "node-opcua-nodeid";
import { ReferenceTypeIds } from "node-opcua-constants";

const hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);
export { stringToQualifiedName } from "node-opcua-data-model";

/**
 * @method constructBrowsePathFromQualifiedName
 * @param startingNode
 * @param targetNames
 * @return {BrowsePath}
 */
export function constructBrowsePathFromQualifiedName(startingNode: { nodeId: NodeId }, targetNames: null | string[]): BrowsePath {

    targetNames = targetNames || [];

    const elements = targetNames.map((targetName) => {
        return {
            referenceTypeId: hierarchicalReferencesId,
            isInverse: false,
            includeSubtypes: true,
            targetName
        };
    });

    const browsePath = new BrowsePath({
        startingNode: startingNode.nodeId, // ROOT
        relativePath: {elements}
    });
    return browsePath;
}
