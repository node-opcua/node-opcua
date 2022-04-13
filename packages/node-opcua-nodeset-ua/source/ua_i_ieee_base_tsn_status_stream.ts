// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { EnumTsnTalkerStatus } from "./enum_tsn_talker_status"
import { EnumTsnListenerStatus } from "./enum_tsn_listener_status"
import { EnumTsnFailureCode } from "./enum_tsn_failure_code"
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
    talkerStatus?: UABaseDataVariable<EnumTsnTalkerStatus, /*z*/DataType.Int32>;
    listenerStatus?: UABaseDataVariable<EnumTsnListenerStatus, /*z*/DataType.Int32>;
    failureCode: UABaseDataVariable<EnumTsnFailureCode, /*z*/DataType.Int32>;
    failureSystemIdentifier: UABaseDataVariable<Byte[], /*z*/DataType.Byte>;
}
export interface UAIIeeeBaseTsnStatusStream extends UABaseInterface, UAIIeeeBaseTsnStatusStream_Base {
}