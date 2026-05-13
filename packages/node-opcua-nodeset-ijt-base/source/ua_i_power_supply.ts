import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";
import type { UAJoiningDataVariable } from "./ua_joining_data_variable";

// ----- this file has been automatically generated - do not edit

export interface UAIPowerSupply_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * actualPower
       * ActualPower is the actual load consumption of the
       * power supply.
       */
      actualPower?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * inputSpecification
       * InputSpecification is the input specification of
       * the power supply. Example: 230 V, 50/60 Hz, 10 A.
       */
      inputSpecification: UABaseDataVariable<UAString, DataType.String>;
      /**
       * nominalPower
       * NominalPower is the maximum output power of the
       * power supply.
       */
      nominalPower?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * outputSpecification
       * OutputSpecification is the output specification
       * of the power supply.
       */
      outputSpecification?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IPowerSupplyType i=1009                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAIPowerSupply_Base extends UAIJoiningSystemAsset_Base {
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIPowerSupply_parameters;
}
export interface UAIPowerSupply extends Omit<UAIJoiningSystemAsset, "parameters">, UAIPowerSupply_Base {}