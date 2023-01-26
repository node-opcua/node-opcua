// ----- this file has been automatically generated - do not edit
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAICable_parameters extends UAFolder { // Object
      /**
       * cableLength
       * The optional CableLength is the length of the
       * cable.
       */
      cableLength?: UAJoiningDataVariable<number, DataType.Double>;
      /**
       * type
       * The optional Type is the classification of the
       * cable.
       */
      type?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:ICableType ns=14;i=1014                        |
 * |isAbstract      |true                                              |
 */
export interface UAICable_Base extends UAITighteningSystemAsset_Base {
    parameters: UAICable_parameters;
}
export interface UAICable extends UAITighteningSystemAsset, UAICable_Base {
}