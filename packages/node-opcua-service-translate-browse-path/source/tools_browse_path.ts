/**
 * @module node-opcua-service-translate-browse-path
 */
import { ReferenceTypeIds } from "node-opcua-constants";
import { QualifiedName, QualifiedNameLike } from "node-opcua-data-model";
import { makeNodeId, NodeId } from "node-opcua-nodeid";
import { BrowsePath } from "./imports";

// const hierarchicalReferencesId = makeNodeId(ReferenceTypeIds.HierarchicalReferences);
const aggregatesReferencesId = makeNodeId(ReferenceTypeIds.Aggregates);

export { stringToQualifiedName } from "node-opcua-data-model";

/**
 * construct a browse path from an array of QualifiedName and a starting Node
 */
export function constructBrowsePathFromQualifiedName(
    startingNode: { nodeId: NodeId },
    targetNames: QualifiedNameLike[] | null
): BrowsePath {
    targetNames = targetNames || [];

    const elements = targetNames.map((targetName) => {
        return {
            isInverse: false,

            includeSubtypes: true,

            referenceTypeId: aggregatesReferencesId,
            targetName
        };
    });

    const browsePath = new BrowsePath({
        relativePath: { elements },
        startingNode: startingNode.nodeId // ROOT
    });
    return browsePath;
}
