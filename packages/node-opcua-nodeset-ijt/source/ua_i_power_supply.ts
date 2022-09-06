// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIPowerSupply_parameters extends UAFolder { // Object
      /**
       * actualPower
       * The optional ActualPower is the actual load
       * consumption of the power supply.
       */
      actualPower?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * inputSpecification
       * The mandatory InputSpecification is the
       * specification of the power supply. Example: 230
       * V, 50/60 Hz, 10A.
       */
      inputSpecification: UABaseDataVariable<UAString, DataType.String>;
      /**
       * nominalPower
       * The optional NominalPower is the maximum output
       * power of the power supply.
       */
      nominalPower?: UAJoiningDataVariable<number, DataType.Double>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IPowerSupplyType ns=14;i=1009                  |
 * |isAbstract      |true                                              |
 */
export interface UAIPowerSupply_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIPowerSupply_parameters;
}
export interface UAIPowerSupply extends UAITighteningSystemAsset, UAIPowerSupply_Base {
}