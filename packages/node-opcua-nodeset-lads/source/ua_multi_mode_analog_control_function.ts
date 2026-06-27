import type { UInt32 } from "node-opcua-basic-types";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UABaseControlFunction, UABaseControlFunction_Base, UABaseControlFunction_operational } from "./ua_base_control_function";
import type { UAControllerParameterSet } from "./ua_controller_parameter_set";

// ----- this file has been automatically generated - do not edit

export interface UAMultiModeAnalogControlFunction_operational extends UABaseControlFunction_operational { // Object
      /**
       * currentMode
       * CurrentMode defines the currently selected mode.
       * Its EnumStrings array lists the different defined
       * modes, which shall match the names of the
       * corresponding elements in the ControllerModeSet.
       * Note: The EnumStrings array contains
       * LocalizedText entries. The DisplayName of the
       * ControllerMode is used to map the child node of
       * the ControllerModeSet. The locale should be
       * “en-US” or empty.
       */
      currentMode: UAMultiStateDiscrete<UInt32, DataType.UInt32>;
}
/**
 * The MultiModeAnalogControlFunctionType is used
 * when a controller or actuator can be operated in
 * different modes, depending on how the target
 * value and current value are represented. A common
 * example in the laboratory and analytical domain
 * is a peristaltic pump. In this case, the user can
 * choose from various operation modes, such as
 * relative pump speed (0 to 100%), absolute pump
 * rotor speed in RPM, volumetric rate in mL/min
 * (requiring pump calibration), or mass flow rate
 * in g/min (requiring knowledge of the fluid
 * density). Another example in the laboratory and
 * analytical domain is centrifuges. Operators can
 * select between RPM or RCF (Rotational Centrifugal
 * Force, defined as a multiple of G-force) modes.
 * The RCF mode considers the radius of the
 * centrifuge rotor when converting RCF to RPM.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiModeAnalogControlFunctionType i=1047                   |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiModeAnalogControlFunction_Base extends UABaseControlFunction_Base {
    /**
     * currentMode
     * CurrentMode defines the currently selected mode.
     * Its EnumStrings array lists the different defined
     * modes, which shall match the names of the
     * corresponding elements in the ControllerModeSet.
     * Note: The EnumStrings array contains
     * LocalizedText entries. The DisplayName of the
     * ControllerMode is used to map the child node of
     * the ControllerModeSet. The locale should be
     * “en-US” or empty.
     */
    currentMode: UAMultiStateDiscrete<UInt32, DataType.UInt32>;
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UAMultiModeAnalogControlFunction_operational;
    /**
     * controllerModeSet
     * ControllerModeSet is the set of target/current
     * value pairs.
     */
    controllerModeSet: UAControllerParameterSet;
}
export interface UAMultiModeAnalogControlFunction extends Omit<UABaseControlFunction, "operational">, UAMultiModeAnalogControlFunction_Base {}