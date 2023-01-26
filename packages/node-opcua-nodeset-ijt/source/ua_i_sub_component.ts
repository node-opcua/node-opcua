// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAITighteningSystemAsset, UAITighteningSystemAsset_Base } from "./ua_i_tightening_system_asset"
export interface UAISubComponent_parameters extends UAFolder { // Object
      /**
       * type
       * The optional Type is a user readable open string
       * to describe the type of sub-component such as
       * network module, etc.
       */
      type?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:ISubComponentType ns=14;i=1016                 |
 * |isAbstract      |true                                              |
 */
export interface UAISubComponent_Base extends UAITighteningSystemAsset_Base {
    parameters: UAISubComponent_parameters;
}
export interface UAISubComponent extends UAITighteningSystemAsset, UAISubComponent_Base {
}