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
 * |typedDefinition |ISrClassType ns=0;i=24169                         |
 * |isAbstract      |true                                              |
 */
export interface UAISrClass_Base extends UABaseInterface_Base {
    id: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
    priority: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
    vid: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
export interface UAISrClass extends UABaseInterface, UAISrClass_Base {
}