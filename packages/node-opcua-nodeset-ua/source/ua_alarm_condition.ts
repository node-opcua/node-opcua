import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { Int16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAcknowledgeableCondition, UAAcknowledgeableCondition_Base } from "./ua_acknowledgeable_condition";
import type { UAAlarmGroup } from "./ua_alarm_group";
import type { UAAudioVariable } from "./ua_audio_variable";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAShelvedStateMachine } from "./ua_shelved_state_machine";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AlarmConditionType i=2915                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAAlarmCondition_Base extends UAAcknowledgeableCondition_Base {
    enabledState: UATwoStateVariable<LocalizedText>;
    activeState: UATwoStateVariable<LocalizedText>;
    inputNode: UAProperty<NodeId, DataType.NodeId>;
    suppressedState?: UATwoStateVariable<LocalizedText>;
    outOfServiceState?: UATwoStateVariable<LocalizedText>;
    shelvingState?: UAShelvedStateMachine;
    suppressedOrShelved: UAProperty<boolean, DataType.Boolean>;
    maxTimeShelved?: UAProperty<number, DataType.Double>;
    audibleEnabled?: UAProperty<boolean, DataType.Boolean>;
    audibleSound?: UAAudioVariable<Buffer>;
    silenceState?: UATwoStateVariable<LocalizedText>;
    onDelay?: UAProperty<number, DataType.Double>;
    offDelay?: UAProperty<number, DataType.Double>;
    firstInGroupFlag?: UABaseDataVariable<boolean, DataType.Boolean>;
    firstInGroup?: UAAlarmGroup;
    latchedState?: UATwoStateVariable<LocalizedText>;
   // PlaceHolder for $AlarmGroup$
    reAlarmTime?: UAProperty<number, DataType.Double>;
    reAlarmRepeatCount?: UABaseDataVariable<Int16, DataType.Int16>;
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
export interface UAAlarmCondition extends Omit<UAAcknowledgeableCondition, "enabledState">, UAAlarmCondition_Base {}