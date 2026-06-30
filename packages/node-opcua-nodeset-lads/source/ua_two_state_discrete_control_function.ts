import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";
import type { DataType } from "node-opcua-variant";

import type { UAControlFunctionStateMachine } from "./ua_control_function_state_machine";
import type { UADiscreteControlFunction, UADiscreteControlFunction_Base } from "./ua_discrete_control_function";

// ----- this file has been automatically generated - do not edit

/**
 * The TwoStateDiscreteControlFunctionType describes
 * a discrete control function with two possible
 * values (e.g., on/off).
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TwoStateDiscreteControlFunctionType i=1042                  |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteControlFunction_Base extends UADiscreteControlFunction_Base {
    /**
     * currentValue
     * CurrentValue is a current discrete process value.
     */
    currentValue: UADiscreteItem<boolean, DataType.Boolean>;
    /**
     * targetValue
     * TargetValue is the targeted discrete set-point
     * value.
     */
    targetValue: UADiscreteItem<boolean, DataType.Boolean>;
    /**
     * controlFunctionState
     * ControlFunctionState is a state machine which
     * represents the execution state and controls the
     * execution of the Function.
     */
    controlFunctionState: UAControlFunctionStateMachine;
}
export interface UATwoStateDiscreteControlFunction extends Omit<UADiscreteControlFunction, "currentValue"|"targetValue"|"controlFunctionState">, UATwoStateDiscreteControlFunction_Base {}