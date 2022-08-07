import { UAVariableT } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";

export interface InstallSetPointOptions {
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
}
