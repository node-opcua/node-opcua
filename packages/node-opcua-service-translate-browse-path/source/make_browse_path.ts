/**
 * @module node-opcua-service-translate-browse-path
 */
import { assert } from "node-opcua-assert";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { BrowsePath } from "node-opcua-types";
import { makeRelativePath } from "./make_relative_path";

function _get_nodeId(node: any): NodeId {
    if (node.nodeId) {
        return node.nodeId;
    }
    return resolveNodeId(node);
}
export function makeBrowsePath(rootNode: any, relativePathBNF: string) {
    return new BrowsePath({
        startingNode: _get_nodeId(rootNode),

        relativePath: makeRelativePath(relativePathBNF)
    });
}
