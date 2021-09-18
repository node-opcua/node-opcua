/**
 * @module node-opcua-service-translate-browse-path
 */
import { assert } from "node-opcua-assert";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { BrowsePath } from "node-opcua-types";
import { makeRelativePath } from "./make_relative_path";

export declare type NodeIdLikeOrWithNodeId =
    | NodeIdLike
    | {
          nodeId: NodeId;
      };
function _get_nodeId(node: NodeIdLikeOrWithNodeId): NodeId {
    if (Object.prototype.hasOwnProperty.call(node,"nodeId")) {
        return (node as any).nodeId;
    }
    return resolveNodeId(node as NodeIdLike);
}
export function makeBrowsePath(rootNode: NodeIdLikeOrWithNodeId, relativePathBNF: string): BrowsePath {
    return new BrowsePath({
        startingNode: _get_nodeId(rootNode),

        relativePath: makeRelativePath(relativePathBNF)
    });
}
