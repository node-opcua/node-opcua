import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProgressEventType i=11436                                   |
 * |isAbstract      |true                                                        |
 */
export interface UAProgressEvent_Base extends UABaseEvent_Base {
    context: UAProperty<any, any>;
    progress: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAProgressEvent extends UABaseEvent, UAProgressEvent_Base {}