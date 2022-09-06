// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32, Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIBattery_parameters extends UAFolder { // Object
      /**
       * capacity
       * The mandatory Capacity is the nominal capacity of
       * the battery.
       */
      capacity: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * chargeCycleCount
       * The optional ChargeCycleCount is the number of
       * times the battery has been charged since the
       * initial operation date.
       */
      chargeCycleCount?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * nominalVoltage
       * The mandatory NominalVoltage is the nominal DC
       * voltage of the battery.
       */
      nominalVoltage: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * numberOfTightenings
       * The optional NumberOfTightenings is the total
       * number of operations performed using the battery.
       */
      numberOfTightenings?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * stateOfCharge
       * The optional StateOfCharge is the state of charge
       * (SOC) indicator functions as a sort of fuel gauge
       * that displays the usable amount of energy like
       * battery estimates in cellphones and laptops. This
       * helps determine optimal charging and discharging.
       * It is given in percentage.
       */
      stateOfCharge?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * stateOfHealth
       * The optional StateOfHealth is the State of Health
       * is a measurement that reflects the general
       * condition of a battery and its ability to deliver
       * the specified performance compared with a fresh
       * battery. It considers such factors as charge
       * acceptance, internal resistance, voltage, and
       * self-discharge. It is given in percentage.
       */
      stateOfHealth?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * type
       * The optional Type is a user readable text to
       * determine the type of battery based on
       * technology, chemical composition, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IBatteryType ns=14;i=1010                      |
 * |isAbstract      |true                                              |
 */
export interface UAIBattery_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIBattery_parameters;
}
export interface UAIBattery extends UAITighteningSystemAsset, UAIBattery_Base {
}