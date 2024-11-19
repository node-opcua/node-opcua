// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int64, Byte, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { DTSignal } from "./dt_signal"
import { UAIJoiningSystemAsset_parameters, UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
export interface UAISensor_parameters extends UAIJoiningSystemAsset_parameters { // Object
      /**
       * measuredValue
       * MeasuredValue is the actual measured value
       * reported from a sensor.
       */
      measuredValue?: UABaseDataVariable<number, DataType.Double>;
      /**
       * overloadCount
       * OverloadCount is the number of overloads of the
       * sensor, where the permissible load of the senor
       * was exceeded.
       */
      overloadCount?: UABaseDataVariable<Int64, DataType.Int64>;
      /**
       * type
       * Type is the classification of a Sensor.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISensorType i=1011                                          |
 * |isAbstract      |true                                                        |
 */
export interface UAISensor_Base extends UAIJoiningSystemAsset_Base {
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
    parameters: UAISensor_parameters;
}
export interface UAISensor extends Omit<UAIJoiningSystemAsset, "identification"|"parameters">, UAISensor_Base {
}