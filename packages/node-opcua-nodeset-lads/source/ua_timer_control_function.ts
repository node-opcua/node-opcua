import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UABaseControlFunction, UABaseControlFunction_Base, UABaseControlFunction_operational } from "./ua_base_control_function";

// ----- this file has been automatically generated - do not edit

export interface UATimerControlFunction_operational extends UABaseControlFunction_operational { // Object
      /**
       * differenceValue
       * The DifferenceValue (aka remaining time) is
       * calculated by subtracting the CurrentValue from
       * the TargetValue. Thus, it counts downwards from
       * the TargetValue to zero.
       */
      differenceValue?: UAAnalogUnitRange<number, DataType.Double>;
}
/**
 * The TimerControlFunctionType defines a simple
 * “one shot” Timer which stops once it has elapsed.
 * It follows the design of other LADS
 * ControlFunctions, utilizing the same state
 * machine and similar variable definitions. As soon
 * as the CurrentValue reaches the TargetValue, the
 * CurrentState of the TimerFunction automatically
 * transitions to Off. This is typically accompanied
 * by some (internal) action/effect, such as
 * stopping the execution of a Function or similar.
 * In the SuspendedState the CurrentValue holds its
 * current value and does not count further until
 * the state switches back to On, either due to a
 * Client command or an internal state change.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TimerControlFunctionType i=1013                             |
 * |isAbstract      |false                                                       |
 */
export interface UATimerControlFunction_Base extends UABaseControlFunction_Base {
    /**
     * differenceValue
     * The DifferenceValue (aka remaining time) is
     * calculated by subtracting the CurrentValue from
     * the TargetValue. Thus, it counts downwards from
     * the TargetValue to zero.
     */
    differenceValue?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * targetValue
     * The timer's target time. As soon as the
     * CurrentValue reaches the TargetValue, the
     * CurrentState of the TimerFunction automatically
     * transitions to Off. This is typically accompanied
     * by some (internal) action/effect, such as
     * stopping the execution of a Function or similar.
     */
    targetValue?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * currentValue
     * Once started, the CurrentValue (aka elapsed time)
     * counts upwards from zero until it reaches the
     * TargetValue (aka target time).
     */
    currentValue?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UATimerControlFunction_operational;
}
export interface UATimerControlFunction extends Omit<UABaseControlFunction, "operational">, UATimerControlFunction_Base {}