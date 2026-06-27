import type { UAMethod } from "node-opcua-address-space-base";
import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UAAnalogControlFunction, UAAnalogControlFunction_Base, UAAnalogControlFunction_operational } from "./ua_analog_control_function";

// ----- this file has been automatically generated - do not edit

export interface UAAnalogControlFunctionWithRelativeTargetValue_operational extends UAAnalogControlFunction_operational { // Object
      /**
       * increaseRate
       * Rate by which the internal target-value is
       * increased on change (e.g., acceleration ramp,
       * aspirating action, ..).
       */
      increaseRate?: UAAnalogUnitRange<number, DataType.Double>;
      /**
       * decreaseRate
       * Rate by which the internal target-value is
       * decreased on change (e.g., deceleration/brake
       * ramp, dispensing action, ..).
       */
      decreaseRate?: UAAnalogUnitRange<number, DataType.Double>;
      modifyTargetValueBy?: UAMethod;
}
/**
 * The
 * AnalogControlFunctionWithRelativeTargetValueType
 * supports applications where the target value is
 * typically modified by relative increments or
 * decrements. Examples of its usage include
 * position controllers where the actuator needs to
 * modify its position relative to the last defined
 * position by a specific amount, or dispenser
 * controllers that are responsible for aspirating
 * or dispensing a certain volume of fluid.  The
 * optional DecreaseRate and IncreaseRate variables
 * can be utilized to customize the dynamics of the
 * resulting action based on application-specific
 * requirements. These variables allow for adapting
 * to factors such as viscosity when aspirating or
 * dispensing fluids.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogControlFunctionWithRelativeTargetValueType i=1029     |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogControlFunctionWithRelativeTargetValue_Base extends UAAnalogControlFunction_Base {
    /**
     * increaseRate
     * Rate by which the internal target-value is
     * increased on change (e.g., acceleration ramp,
     * aspirating action, ..).
     */
    increaseRate?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * decreaseRate
     * Rate by which the internal target-value is
     * decreased on change (e.g., deceleration/brake
     * ramp, dispensing action, ..).
     */
    decreaseRate?: UAAnalogUnitRange<number, DataType.Double>;
    modifyTargetValueBy?: UAMethod;
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UAAnalogControlFunctionWithRelativeTargetValue_operational;
}
export interface UAAnalogControlFunctionWithRelativeTargetValue extends Omit<UAAnalogControlFunction, "operational">, UAAnalogControlFunctionWithRelativeTargetValue_Base {}