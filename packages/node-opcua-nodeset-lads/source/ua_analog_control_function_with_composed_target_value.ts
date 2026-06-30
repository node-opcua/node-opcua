import type { UAAnalogControlFunction, UAAnalogControlFunction_Base } from "./ua_analog_control_function";
import type { UAVariableSet } from "./ua_variable_set";

// ----- this file has been automatically generated - do not edit

/**
 * The
 * AnalogControlFunctionWithComposedTargetValueType
 * describes an analogue control function (using
 * analogue values), but the TargetValue is composed
 * of several partial values. An example of a
 * composed target value used in mechanical stress
 * analysers involves combining a static/constant
 * base value with periodically changing values for
 * defined amplitude, frequency, and waveform. As
 * the TargetValue is calculated from variables in
 * the TargetValueSet, it should be read-only.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogControlFunctionWithComposedTargetValueType i=1052     |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogControlFunctionWithComposedTargetValue_Base extends UAAnalogControlFunction_Base {
    /**
     * targetValueSet
     * TargetValueSet contains the partial values for
     * the target value.
     */
    targetValueSet: UAVariableSet;
}
export interface UAAnalogControlFunctionWithComposedTargetValue extends UAAnalogControlFunction, UAAnalogControlFunctionWithComposedTargetValue_Base {}