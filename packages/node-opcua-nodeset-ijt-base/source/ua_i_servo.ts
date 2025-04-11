// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int16 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_identification"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
export interface UAIServo_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * nodeNumber
       * NodeNumber is the node identifier in multiple
       * configurations. Examples: Cabinet with one
       * controller and multiple servo/modules.
       */
      nodeNumber?: UABaseDataVariable<Int16, DataType.Int16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IServoType i=1008                                           |
 * |isAbstract      |true                                                        |
 */
export interface UAIServo_Base extends UAIJoiningSystemAsset_Base {
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
    parameters: UAIServo_parameters;
}
export interface UAIServo extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAIServo_Base {
}