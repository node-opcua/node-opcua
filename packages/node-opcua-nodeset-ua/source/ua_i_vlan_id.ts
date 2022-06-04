// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IVlanIdType ns=0;i=25218                          |
 * |isAbstract      |true                                              |
 */
export interface UAIVlanId_Base extends UABaseInterface_Base {
    vlanId: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
export interface UAIVlanId extends UABaseInterface, UAIVlanId_Base {
}