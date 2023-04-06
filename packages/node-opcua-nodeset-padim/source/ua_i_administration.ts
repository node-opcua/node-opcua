// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:IAdministrationType ns=20;i=1050               |
 * |isAbstract      |true                                              |
 */
export interface UAIAdministration_Base extends UABaseInterface_Base {
    displayLanguage?: UABaseDataVariable<UAString, DataType.String>;
    dateOfLastChange?: UABaseDataVariable<Date, DataType.DateTime>;
    factoryReset?: UAMethod;
}
export interface UAIAdministration extends UABaseInterface, UAIAdministration_Base {
}