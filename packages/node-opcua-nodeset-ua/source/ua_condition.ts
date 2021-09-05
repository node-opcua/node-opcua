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
    conditionClassId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    conditionClassName: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    conditionSubClassId?: UAProperty<NodeId[], /*z*/DataType.NodeId>;
    conditionSubClassName?: UAProperty<LocalizedText[], /*z*/DataType.LocalizedText>;
    conditionName: UAProperty<UAString, /*z*/DataType.String>;
    branchId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    retain: UAProperty<boolean, /*z*/DataType.Boolean>;
    enabledState: UATwoStateVariable<LocalizedText>;
    quality: UAConditionVariable<StatusCode, /*z*/DataType.StatusCode>;
    lastSeverity: UAConditionVariable<UInt16, /*z*/DataType.UInt16>;
    comment: UAConditionVariable<LocalizedText, /*z*/DataType.LocalizedText>;
    clientUserId: UAProperty<UAString, /*z*/DataType.String>;
    disable: UAMethod;
    enable: UAMethod;
    addComment: UAMethod;
    conditionRefresh: UAMethod;
    conditionRefresh2: UAMethod;
}
export interface UACondition extends UABaseEvent, UACondition_Base {
}