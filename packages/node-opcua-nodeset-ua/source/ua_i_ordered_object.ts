import type { UAProperty } from "node-opcua-address-space-base";

import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOrderedObjectType i=23513                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIOrderedObject_Base extends UABaseInterface_Base {
    numberInList: UAProperty<any, any>;
}
export interface UAIOrderedObject extends UABaseInterface, UAIOrderedObject_Base {}