// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt16, Byte } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeTsnVlanTagType ns=0;i=24202                  |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeTsnVlanTag_Base extends UABaseInterface_Base {
    vlanId: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    priorityCodePoint: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
}
export interface UAIIeeeTsnVlanTag extends UABaseInterface, UAIIeeeTsnVlanTag_Base {
}