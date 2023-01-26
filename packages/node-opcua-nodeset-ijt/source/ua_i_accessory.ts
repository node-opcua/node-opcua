// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAIAccessory_parameters extends UAFolder { // Object
      /**
       * type
       * The optional Type is a user readable open string
       * to describe the type of accessory such as socket
       * selector, operator panel, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:IAccessoryType ns=14;i=1015                    |
 * |isAbstract      |true                                              |
 */
export interface UAIAccessory_Base extends UAITighteningSystemAsset_Base {
    parameters: UAIAccessory_parameters;
}
export interface UAIAccessory extends UAITighteningSystemAsset, UAIAccessory_Base {
}