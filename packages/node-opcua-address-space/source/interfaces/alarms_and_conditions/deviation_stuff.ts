import { UAVariableT, UAVariable, IAddressSpace } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";

export interface DeviationStuff {
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    setpointNodeNode: UAVariable;
    _onSetpointDataValueChange(dataValue: DataValue): void;
    _setStateBasedOnInputValue(value: any): void;
    getSetpointNodeNode(): UAVariable;
    getInputNodeValue(): any;
    getSetpointValue(): number | null;

    readonly addressSpace: IAddressSpace;
}