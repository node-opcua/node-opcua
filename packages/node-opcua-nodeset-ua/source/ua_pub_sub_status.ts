import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumPubSubState } from "./enum_pub_sub_state";
import type { UABaseDataVariable } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubStatusType i=14643                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubStatus_Base {
    state: UABaseDataVariable<EnumPubSubState, DataType.Int32>;
    enable?: UAMethod;
    disable?: UAMethod;
}
export interface UAPubSubStatus extends UAObject, UAPubSubStatus_Base {}