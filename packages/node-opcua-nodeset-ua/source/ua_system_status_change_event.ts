import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumServerState } from "./enum_server_state";
import type { UASystemEvent, UASystemEvent_Base } from "./ua_system_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SystemStatusChangeEventType i=11446                         |
 * |isAbstract      |true                                                        |
 */
export interface UASystemStatusChangeEvent_Base extends UASystemEvent_Base {
    systemState: UAProperty<EnumServerState, DataType.Int32>;
}
export interface UASystemStatusChangeEvent extends UASystemEvent, UASystemStatusChangeEvent_Base {}