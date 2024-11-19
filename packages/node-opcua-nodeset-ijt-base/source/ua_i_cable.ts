// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString } from "node-opcua-basic-types"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { DTSignal } from "./dt_signal"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
export interface UAICable_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * cableLength
       * CableLength is the length of the cable.
       */
      cableLength?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * type
       * Type is the classification of the cable.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ICableType i=1014                                           |
 * |isAbstract      |true                                                        |
 */
export interface UAICable_Base extends UAIJoiningSystemAsset_Base {
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
    parameters: UAICable_parameters;
}
export interface UAICable extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAICable_Base {
}