// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
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
    state: UABaseDataVariable<any, any>;
    enable?: UAMethod;
    disable?: UAMethod;
}
export interface UAPubSubStatus extends UAObject, UAPubSubStatus_Base {
}