import type { Byte, UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeTsnVlanTagType i=24202                                 |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeTsnVlanTag_Base extends UABaseInterface_Base {
    vlanId: UABaseDataVariable<UInt16, DataType.UInt16>;
    priorityCodePoint: UABaseDataVariable<Byte, DataType.Byte>;
}
export interface UAIIeeeTsnVlanTag extends UABaseInterface, UAIIeeeTsnVlanTag_Base {}