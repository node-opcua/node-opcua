import type { Byte } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumTsnFailureCode } from "./enum_tsn_failure_code";
import type { EnumTsnListenerStatus } from "./enum_tsn_listener_status";
import type { EnumTsnTalkerStatus } from "./enum_tsn_talker_status";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeBaseTsnStatusStreamType i=24183                        |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeBaseTsnStatusStream_Base extends UABaseInterface_Base {
    talkerStatus?: UABaseDataVariable<EnumTsnTalkerStatus, DataType.Int32>;
    listenerStatus?: UABaseDataVariable<EnumTsnListenerStatus, DataType.Int32>;
    failureCode: UABaseDataVariable<EnumTsnFailureCode, DataType.Int32>;
    failureSystemIdentifier: UABaseDataVariable<Byte[], DataType.Byte>;
}
export interface UAIIeeeBaseTsnStatusStream extends UABaseInterface, UAIIeeeBaseTsnStatusStream_Base {}