import type { UAMethod } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAdministrationType i=1050                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIAdministration_Base extends UABaseInterface_Base {
    displayLanguage?: UABaseDataVariable<UAString, DataType.String>;
    dateOfLastChange?: UABaseDataVariable<Date, DataType.DateTime>;
    factoryReset?: UAMethod;
}
export interface UAIAdministration extends UABaseInterface, UAIAdministration_Base {}