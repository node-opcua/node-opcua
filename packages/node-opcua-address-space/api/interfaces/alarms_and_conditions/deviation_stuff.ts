import type { IAddressSpace, UAVariableT } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-basic-types";
import type { DataValue } from "node-opcua-data-value";
import type { SetPointSupport } from "./install_setpoint_options.js";

export interface DeviationStuff extends SetPointSupport {
    /**
     * What the alarm does when the value of its setpoint node changes. A deviation alarm
     * watches two nodes, not one, and this is the setpoint half: assign to it to decide what
     * moving the setpoint means, without deriving from an implementation class:
     *
     * ```ts
     * alarm.onSetpointDataValueChange = (dataValue) => {
     *     // a setpoint the operator is still dialling in should not trip the alarm
     *     if (dataValue.statusCode.isGood()) {
     *         alarm.setStateBasedOnInputValue(alarm.getInputNodeValue()!);
     *     }
     * };
     * ```
     *
     * The default re-evaluates the alarm state against the new setpoint, which is what a
     * deviation alarm means; assigning to it replaces that.
     *
     * The old name `_onSetpointDataValueChange` still works and is deprecated.
     */
    onSetpointDataValueChange(dataValue: DataValue): void;

    /**
     * @deprecated assign {@link DeviationStuff.onSetpointDataValueChange} instead; this delegates to it.
     */
    _onSetpointDataValueChange(dataValue: DataValue): void;

    /**
     * @deprecated assign `setStateBasedOnInputValue` on `UALimitAlarmHelper` instead, which every
     * deviation alarm also is; this delegates to it. It is kept here, with its original looser
     * signature, because removing it from a published interface would break implementers.
     */
    _setStateBasedOnInputValue(value: unknown): void;

    getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined;

    getInputNodeValue(): number | null;
    getSetpointValue(): number | null;

    readonly addressSpace: IAddressSpace;
}
