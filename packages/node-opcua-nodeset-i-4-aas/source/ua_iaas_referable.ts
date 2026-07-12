import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAASReferableType i=1033                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAIAASReferable_Base extends UABaseInterface_Base {
    category: UAProperty<UAString, DataType.String>;
}
export interface UAIAASReferable extends UABaseInterface, UAIAASReferable_Base {}