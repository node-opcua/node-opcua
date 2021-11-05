// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeBaseTsnStatusStreamType ns=0;i=24183         |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeBaseTsnStatusStream_Base extends UABaseInterface_Base {
    talkerStatus?: UABaseDataVariable<any, any>;
    listenerStatus?: UABaseDataVariable<any, any>;
    failureCode: UABaseDataVariable<any, any>;
    failureSystemIdentifier: UABaseDataVariable<Byte[], /*z*/DataType.Byte>;
}
export interface UAIIeeeBaseTsnStatusStream extends UABaseInterface, UAIIeeeBaseTsnStatusStream_Base {
}