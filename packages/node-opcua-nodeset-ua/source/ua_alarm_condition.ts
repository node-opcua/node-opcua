// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { Int16 } from "node-opcua-basic-types"
import { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "./ua_acknowledgeable_condition"
import { UATwoStateVariable } from "./ua_two_state_variable"
import { UAShelvedStateMachine } from "./ua_shelved_state_machine"
import { UAAudioVariable } from "./ua_audio_variable"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAAlarmGroup } from "./ua_alarm_group"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AlarmConditionType ns=0;i=2915                    |
 * |isAbstract      |false                                             |
 */
export interface UAAlarmCondition_Base extends UAAcknowledgeableCondition_Base {
    enabledState: UATwoStateVariable<LocalizedText>;
    activeState: UATwoStateVariable<LocalizedText>;
    inputNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    suppressedState?: UATwoStateVariable<LocalizedText>;
    outOfServiceState?: UATwoStateVariable<LocalizedText>;
    shelvingState?: UAShelvedStateMachine;
    suppressedOrShelved: UAProperty<boolean, /*z*/DataType.Boolean>;
    maxTimeShelved?: UAProperty<number, /*z*/DataType.Double>;
    audibleEnabled?: UAProperty<boolean, /*z*/DataType.Boolean>;
    audibleSound?: UAAudioVariable<Buffer>;
    silenceState?: UATwoStateVariable<LocalizedText>;
    onDelay?: UAProperty<number, /*z*/DataType.Double>;
    offDelay?: UAProperty<number, /*z*/DataType.Double>;
    firstInGroupFlag?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    firstInGroup?: UAAlarmGroup;
    latchedState?: UATwoStateVariable<LocalizedText>;
    reAlarmTime?: UAProperty<number, /*z*/DataType.Double>;
    reAlarmRepeatCount?: UABaseDataVariable<Int16, /*z*/DataType.Int16>;
    silence?: UAMethod;
    suppress?: UAMethod;
    suppress2?: UAMethod;
    unsuppress?: UAMethod;
    unsuppress2?: UAMethod;
    removeFromService?: UAMethod;
    removeFromService2?: UAMethod;
    placeInService?: UAMethod;
    placeInService2?: UAMethod;
    reset?: UAMethod;
    reset2?: UAMethod;
    getGroupMemberships?: UAMethod;
}
export interface UAAlarmCondition extends Omit<UAAcknowledgeableCondition, "enabledState">, UAAlarmCondition_Base {
}