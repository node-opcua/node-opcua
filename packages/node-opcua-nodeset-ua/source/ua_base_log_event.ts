import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseLogEventType i=19362                                    |
 * |isAbstract      |true                                                        |
 */
export interface UABaseLogEvent_Base extends UABaseEvent_Base {
    conditionClassId: UAProperty<NodeId, DataType.NodeId>;
    conditionClassName: UAProperty<LocalizedText, DataType.LocalizedText>;
    errorCode?: UAProperty<StatusCode, DataType.StatusCode>;
    errorCodeNode?: UAProperty<NodeId, DataType.NodeId>;
}
export interface UABaseLogEvent extends Omit<UABaseEvent, "conditionClassId"|"conditionClassName">, UABaseLogEvent_Base {}