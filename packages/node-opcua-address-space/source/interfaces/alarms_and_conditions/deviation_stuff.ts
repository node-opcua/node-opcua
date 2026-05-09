import type { IAddressSpace, UAVariableT } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-basic-types";
import type { DataValue } from "node-opcua-data-value";
import type { SetPointSupport } from "./install_setpoint_options";

export interface DeviationStuff extends SetPointSupport {
    _onSetpointDataValueChange(dataValue: DataValue): void;
    _setStateBasedOnInputValue(value: unknown): void;

    getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined;

    getInputNodeValue(): number | null;
    getSetpointValue(): number | null;

    readonly addressSpace: IAddressSpace;
}
