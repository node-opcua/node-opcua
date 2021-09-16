// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
export interface UAMotor_parameterSet extends UAObject { // Object
      /**
       * brakeReleased
       * Indicates an optional variable used only for
       * motors with brakes. If BrakeReleased is TRUE the
       * motor is free to run. FALSE means that the motor
       * shaft is locked by the brake.
       */
      brakeReleased?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      /**
       * motorTemperature
       * The motor temperature provides the temperature of
       * the motor. If there is no temperature sensor the
       * value is set to \"null\".
       */
      motorTemperature: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * effectiveLoadRate
       * EffectiveLoadRate is expressed as a percentage of
       * maximum continuous load. The Joule integral is
       * typically used to calculate the current load.
       * Duration should be defined and documented by the
       * vendor.
       */
      effectiveLoadRate?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
/**
 * The MotorType is for representing instances of
 * electric motors.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:MotorType ns=7;i=1019                           |
 * |isAbstract      |false                                             |
 */
export interface UAMotor_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAMotor_parameterSet;
    manufacturer: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    model: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    productCode: UAProperty<UAString, /*z*/DataType.String>;
    serialNumber: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAMotor extends Omit<UAComponent, "parameterSet"|"manufacturer"|"model"|"productCode"|"serialNumber">, UAMotor_Base {
}