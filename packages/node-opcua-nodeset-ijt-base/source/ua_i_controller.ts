// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_identification"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
export interface UAIController_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * type
       * Type is the classification of a Controller.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IControllerType i=1003                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIController_Base extends UAIJoiningSystemAsset_Base {
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
    parameters: UAIController_parameters;
}
export interface UAIController extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIController_Base {
}