// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IOrderedObjectType ns=0;i=23513                   |
 * |isAbstract      |true                                              |
 */
export interface UAIOrderedObject_Base extends UABaseInterface_Base {
    numberInList: UAProperty<any, any>;
}
export interface UAIOrderedObject extends UABaseInterface, UAIOrderedObject_Base {
}