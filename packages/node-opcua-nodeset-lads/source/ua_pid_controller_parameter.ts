import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UAControllerTuningParameter, UAControllerTuningParameter_Base } from "./ua_controller_tuning_parameter";

// ----- this file has been automatically generated - do not edit

/**
 * The PidControllerParameterType contains the
 * parameters of an PID controller.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PidControllerParameterType i=1030                           |
 * |isAbstract      |false                                                       |
 */
export interface UAPidControllerParameter_Base extends UAControllerTuningParameter_Base {
    /**
     * ctrlP
     * CtrlP is the proportional controller parameter
     */
    ctrlP?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * ctrlTd
     * CtrlTd is the derivate controller parameter
     */
    ctrlTd?: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * ctrlTi
     * CtrlTi is the integrator controller parameter.
     */
    ctrlTi?: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAPidControllerParameter extends UAControllerTuningParameter, UAPidControllerParameter_Base {}