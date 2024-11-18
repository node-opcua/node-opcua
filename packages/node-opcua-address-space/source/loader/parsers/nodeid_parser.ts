import { resolveNodeId, NodeId, NodeIdLike } from "node-opcua-nodeid";


export const makeNodeIdParser = (_translateNodeId: (nodeId: string) => NodeId) => ({
    NodeId: {
        init(this: any) {
            this.nodeId = "";
        },
        parser: {
            Identifier: {
                finish(this: any) {
                    this.parent.nodeId = _translateNodeId(resolveNodeId(this.text.trim()).toString());
                }
            }
        }
    }
});