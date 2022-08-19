import { UAVariableT, UAVariable, IAddressSpace } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { DataValue } from "node-opcua-data-value";
import { SetPointSupport } from "./install_setpoint_options";

export interface DeviationStuff extends SetPointSupport {
    
    
    _onSetpointDataValueChange(dataValue: DataValue): void;
    _setStateBasedOnInputValue(value: any): void;
    
    getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined ;

    getInputNodeValue(): any;
    getSetpointValue(): number | null;

    readonly addressSpace: IAddressSpace;
}
