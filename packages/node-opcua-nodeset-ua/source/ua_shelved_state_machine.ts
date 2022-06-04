// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine"
import { UAState } from "./ua_state"
import { UATransition } from "./ua_transition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ShelvedStateMachineType ns=0;i=2929               |
 * |isAbstract      |false                                             |
 */
export interface UAShelvedStateMachine_Base extends UAFiniteStateMachine_Base {
    unshelveTime: UAProperty<number, /*z*/DataType.Double>;
    unshelved: UAState;
    timedShelved: UAState;
    oneShotShelved: UAState;
    unshelvedToTimedShelved: UATransition;
    unshelvedToOneShotShelved: UATransition;
    timedShelvedToUnshelved: UATransition;
    timedShelvedToOneShotShelved: UATransition;
    oneShotShelvedToUnshelved: UATransition;
    oneShotShelvedToTimedShelved: UATransition;
    timedShelve: UAMethod;
    timedShelve2?: UAMethod;
    unshelve: UAMethod;
    unshelve2?: UAMethod;
    oneShotShelve: UAMethod;
    oneShotShelve2?: UAMethod;
}
export interface UAShelvedStateMachine extends UAFiniteStateMachine, UAShelvedStateMachine_Base {
}