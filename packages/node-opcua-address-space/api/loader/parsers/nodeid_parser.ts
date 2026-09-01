import { type NodeId, resolveNodeId } from "node-opcua-nodeid";

interface NodeIdParserState {
    nodeId: string | NodeId;
}
interface IdentifierParserState {
    text: string;
    parent: NodeIdParserState;
}

export const makeNodeIdParser = (_translateNodeId: (nodeId: string) => NodeId) => ({
    NodeId: {
        init(this: NodeIdParserState) {
            this.nodeId = "";
        },
        parser: {
            Identifier: {
                finish(this: IdentifierParserState) {
                    this.parent.nodeId = _translateNodeId(resolveNodeId(this.text.trim()).toString());
                }
            }
        }
    }
});
