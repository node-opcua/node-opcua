import type { Byte, Int64 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_parameters } from "./ua_i_joining_system_asset";

// ----- this file has been automatically generated - do not edit

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
       * sensor, where the permissible load of the sensor
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
     * parameters
     * The Parameters Object is an instance of
     * 0:FolderType to group set of common parameters of
     * an asset in a joining system.
     */
    parameters: UAISensor_parameters;
}
export interface UAISensor extends Omit<UAIJoiningSystemAsset, "parameters">, UAISensor_Base {}