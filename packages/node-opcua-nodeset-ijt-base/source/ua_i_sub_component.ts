// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { DTSignal } from "./dt_signal"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
export interface UAISubComponent_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is a user readable open string to describe
       * the type of subcomponent such as network module,
       * etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISubComponentType i=1016                                    |
 * |isAbstract      |true                                                        |
 */
export interface UAISubComponent_Base extends UAIJoiningSystemAsset_Base {
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
    parameters?: UAISubComponent_parameters;
}
export interface UAISubComponent extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAISubComponent_Base {
}