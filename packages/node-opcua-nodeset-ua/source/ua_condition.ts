import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";
import type { UAConditionVariable } from "./ua_condition_variable";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConditionType i=2782                                        |
 * |isAbstract      |true                                                        |
 */
export interface UACondition_Base extends UABaseEvent_Base {
    conditionClassId: UAProperty<NodeId, DataType.NodeId>;
    conditionClassName: UAProperty<LocalizedText, DataType.LocalizedText>;
    conditionSubClassId?: UAProperty<NodeId[], DataType.NodeId>;
    conditionSubClassName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    conditionName: UAProperty<UAString, DataType.String>;
    branchId: UAProperty<NodeId, DataType.NodeId>;
    retain: UAProperty<boolean, DataType.Boolean>;
    supportsFilteredRetain: UAProperty<boolean, DataType.Boolean>;
    enabledState: UATwoStateVariable<LocalizedText>;
    quality: UAConditionVariable<StatusCode, DataType.StatusCode>;
    lastSeverity: UAConditionVariable<UInt16, DataType.UInt16>;
    comment: UAConditionVariable<LocalizedText, DataType.LocalizedText>;
    clientUserId: UAProperty<UAString, DataType.String>;
    disable: UAMethod;
    enable: UAMethod;
    addComment: UAMethod;
    conditionRefresh: UAMethod;
    conditionRefresh2: UAMethod;
}
export interface UACondition extends Omit<UABaseEvent, "conditionClassId"|"conditionClassName"|"conditionSubClassId"|"conditionSubClassName">, UACondition_Base {}