import { assert } from "node-opcua-assert";
import { BrowsePath } from "node-opcua-types";
import { makeRelativePath } from "./make_relative_path";
import { resolveNodeId, NodeId } from "node-opcua-nodeid";

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
