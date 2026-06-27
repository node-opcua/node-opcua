import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UABaseControlFunction, UABaseControlFunction_Base, UABaseControlFunction_operational } from "./ua_base_control_function";
import type { UAControlFunctionStateMachine } from "./ua_control_function_state_machine";

// ----- this file has been automatically generated - do not edit

export interface UAAnalogControlFunction_operational extends UABaseControlFunction_operational { // Object
      /**
       * currentValue
       * CurrentValue is the current process value.
       */
      currentValue: UAAnalogUnitRange<number, DataType.Double>;
      /**
       * targetValue
       * TargetValue is the targeted set-point value.
       */
      targetValue: UAAnalogUnitRange<number, DataType.Double>;
}
/**
 * The AnalogControlFunctionType describes an
 * analogue control function (using analogue
 * values). More specialized analogue control
 * functions can be derived from this ObjectType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogControlFunctionType i=1009                            |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogControlFunction_Base extends UABaseControlFunction_Base {
    /**
     * currentValue
     * CurrentValue is the current process value.
     */
    currentValue: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * targetValue
     * TargetValue is the targeted set-point value.
     */
    targetValue: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UAAnalogControlFunction_operational;
    /**
     * controlFunctionState
     * ControlFunctionState is a state machine which
     * represents the execution state and controls the
     * execution of the Function.
     */
    controlFunctionState: UAControlFunctionStateMachine;
}
export interface UAAnalogControlFunction extends Omit<UABaseControlFunction, "operational"|"controlFunctionState">, UAAnalogControlFunction_Base {}