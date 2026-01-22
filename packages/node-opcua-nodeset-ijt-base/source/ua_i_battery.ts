// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int64, Byte, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_identification } from "./ua_i_joining_system_asset"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
export interface UAIBattery_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * capacity
       * Capacity is the nominal capacity of the battery.
       */
      capacity?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * chargeCycleCount
       * ChargeCycleCount is the number of times the
       * battery has been charged since the initial
       * operation date.
       */
      chargeCycleCount?: UABaseDataVariable<Int64, DataType.Int64>;
      /**
       * nominalVoltage
       * NominalVoltage is the nominal DC voltage of the
       * battery.
       */
      nominalVoltage: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * stateOfCharge
       * StateOfCharge is the state of charge (SOC)
       * indicator functions as a sort of fuel gauge that
       * displays the usable amount of energy. This helps
       * determine optimal charging and discharging. It is
       * given in percentage.
       */
      stateOfCharge?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * stateOfHealth
       * StateOfHealth is the State of Health is a
       * measurement that reflects the general condition
       * of a battery and its ability to deliver the
       * specified performance compared with a fresh
       * battery. It considers such factors as charge
       * acceptance, internal resistance, voltage, and
       * self-discharge. It is given in percentage.
       */
      stateOfHealth?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * type
       * Type is a user readable text to determine the
       * type of battery such as pack type, technology,
       * chemical composition, battery standard, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IBatteryType i=1010                                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIBattery_Base extends UAIJoiningSystemAsset_Base {
    /**
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting IJoiningSystemAssetType will replace
     * it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAIJoiningSystemAsset_identification;
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIBattery_parameters;
}
export interface UAIBattery extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIBattery_Base {
}