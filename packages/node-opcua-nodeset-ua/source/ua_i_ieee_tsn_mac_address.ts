// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeTsnMacAddressType ns=0;i=24199               |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeTsnMacAddress_Base extends UABaseInterface_Base {
    destinationAddress: UABaseDataVariable<Byte[], /*z*/DataType.Byte>;
    sourceAddress?: UABaseDataVariable<Byte[], /*z*/DataType.Byte>;
}
export interface UAIIeeeTsnMacAddress extends UABaseInterface, UAIIeeeTsnMacAddress_Base {
}