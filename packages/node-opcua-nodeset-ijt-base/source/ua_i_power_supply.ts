// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_identification"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
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
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting IJoiningSystemAssetType will replace
     * it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAMachineryItemIdentification;
    /**
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAIPowerSupply_parameters;
}
export interface UAIPowerSupply extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIPowerSupply_Base {
}