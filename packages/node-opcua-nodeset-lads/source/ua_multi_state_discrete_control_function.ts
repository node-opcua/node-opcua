import type { UInt32 } from "node-opcua-basic-types";
import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";
import type { DataType } from "node-opcua-variant";

import type { UAControlFunctionStateMachine } from "./ua_control_function_state_machine";
import type { UADiscreteControlFunction, UADiscreteControlFunction_Base } from "./ua_discrete_control_function";

// ----- this file has been automatically generated - do not edit

/**
 * The MultiStateDiscreteControlFunctionType
 * describes a discrete control function (using more
 * than two discrete values).
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiStateDiscreteControlFunctionType i=1045                |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteControlFunction_Base extends UADiscreteControlFunction_Base {
    /**
     * currentValue
     * CurrentValue is a current discrete process value.
     */
    currentValue: UADiscreteItem<UInt32, DataType.UInt32>;
    /**
     * targetValue
     * TargetValue is the targeted discrete set-point
     * value.
     */
    targetValue: UADiscreteItem<UInt32, DataType.UInt32>;
    /**
     * controlFunctionState
     * ControlFunctionState is a state machine which
     * represents the execution state and controls the
     * execution of the Function.
     */
    controlFunctionState: UAControlFunctionStateMachine;
}
export interface UAMultiStateDiscreteControlFunction extends Omit<UADiscreteControlFunction, "currentValue"|"targetValue"|"controlFunctionState">, UAMultiStateDiscreteControlFunction_Base {}