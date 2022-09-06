// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIFeeder_parameters extends UAFolder { // Object
      /**
       * feedingSpeed
       * The optional FeedingSpeed indicates the output in
       * parts per time. Example: fasteners / minute.
       */
      feedingSpeed?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * fillLevel
       * The optional FillLevel is the fill level in the
       * feeder in percentage [%]. (0%=empty, 100% = full).
       */
      fillLevel?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * material
       * The mandatory Material is the type or name of the
       * part which is supplied by the feeder.
       */
      material: UABaseDataVariable<UAString, DataType.String>;
      /**
       * type
       * The optional Type is the classification of a
       * Feeder.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IFeederType ns=14;i=1012                       |
 * |isAbstract      |true                                              |
 */
export interface UAIFeeder_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIFeeder_parameters;
}
export interface UAIFeeder extends UAITighteningSystemAsset, UAIFeeder_Base {
}