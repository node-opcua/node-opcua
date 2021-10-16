import { NodeId } from "node-opcua-nodeid";
import { DataTypeAndEncodingId, MapDataTypeAndEncodingIdProvider } from "../source";

export class MockProvider implements MapDataTypeAndEncodingIdProvider {
    private _map: { [key: string]: DataTypeAndEncodingId } = {};
    private i = 1;
    constructor() {
        //
    }
    public getDataTypeAndEncodingId(key: string): DataTypeAndEncodingId | null {
        if (!this._map[key]) {
            const dataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, this.i++, 1);
            const binaryEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, this.i++, 1);
            const xmlEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, this.i++, 1);
            const jsonEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, this.i++, 1);

            this._map[key] = {
                binaryEncodingNodeId,
                dataTypeNodeId,
                jsonEncodingNodeId,
                xmlEncodingNodeId
            };
        }
        return this._map[key] || null;
    }
}
