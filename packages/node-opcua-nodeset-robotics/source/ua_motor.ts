// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
export interface UAMotor_parameterSet extends UAObject { // Object
      /**
       * brakeReleased
       * Indicates an optional variable used only for
       * motors with brakes. If BrakeReleased is TRUE the
       * motor is free to run. FALSE means that the motor
       * shaft is locked by the brake.
       */
      brakeReleased?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * effectiveLoadRate
       * EffectiveLoadRate is expressed as a percentage of
       * maximum continuous load. The Joule integral is
       * typically used to calculate the current load.
       * Duration should be defined and documented by the
       * vendor.
       */
      effectiveLoadRate?: UABaseDataVariable<UInt16, DataType.UInt16>;
      /**
       * motorTemperature
       * The motor temperature provides the temperature of
       * the motor. If there is no temperature sensor the
       * value is set to \"null\".
       */
      motorTemperature: UAAnalogUnit<number, DataType.Double>;
}
/**
 * The MotorType is for representing instances of
 * electric motors.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MotorType i=1019                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAMotor_Base extends UAComponent_Base {
    assetId?: UAProperty<UAString, DataType.String>;
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAMotor_parameterSet;
    productCode: UAProperty<UAString, DataType.String>;
    serialNumber: UAProperty<UAString, DataType.String>;
}
export interface UAMotor extends Omit<UAComponent, "assetId"|"manufacturer"|"model"|"parameterSet"|"productCode"|"serialNumber">, UAMotor_Base {
}