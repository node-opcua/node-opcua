// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { DTSignal } from "./dt_signal"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
export interface UAIFeeder_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * feedingSpeed
       * FeedingSpeed indicates the output in parts per
       * time. Example: fasteners / second.
       */
      feedingSpeed?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * fillLevel
       * FillLevel is the fill level in the feeder in
       * percentage [%]. (0%=empty, 100% = full).
       */
      fillLevel?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * material
       * Material is the type or name of the part which is
       * supplied by the feeder.
       */
      material: UABaseDataVariable<UAString, DataType.String>;
      /**
       * type
       * Type is the classification of a Feeder.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IFeederType i=1012                                          |
 * |isAbstract      |true                                                        |
 */
export interface UAIFeeder_Base extends UAIJoiningSystemAsset_Base {
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
    parameters: UAIFeeder_parameters;
}
export interface UAIFeeder extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIFeeder_Base {
}