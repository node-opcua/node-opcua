// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EnumPubSubState } from "./enum_pub_sub_state"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubStatusType ns=0;i=14643                     |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubStatus_Base {
    state: UABaseDataVariable<EnumPubSubState, /*z*/DataType.Int32>;
    enable?: UAMethod;
    disable?: UAMethod;
}
export interface UAPubSubStatus extends UAObject, UAPubSubStatus_Base {
}