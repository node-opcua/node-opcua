// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "./ua_base_event"
import { UATwoStateVariable } from "./ua_two_state_variable"
import { UAConditionVariable } from "./ua_condition_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ConditionType ns=0;i=2782                         |
 * |isAbstract      |true                                              |
 */
export interface UACondition_Base extends UABaseEvent_Base {
    conditionClassId: UAProperty<NodeId, DataType.NodeId>;
    conditionClassName: UAProperty<LocalizedText, DataType.LocalizedText>;
    conditionSubClassId?: UAProperty<NodeId[], DataType.NodeId>;
    conditionSubClassName?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    conditionName: UAProperty<UAString, DataType.String>;
    branchId: UAProperty<NodeId, DataType.NodeId>;
    retain: UAProperty<boolean, DataType.Boolean>;
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
export interface UACondition extends UABaseEvent, UACondition_Base {
}