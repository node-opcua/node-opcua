// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int16 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/dist/dt_enum_value"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OperationStateMachineType i=1006                            |
 * |isAbstract      |true                                                        |
 */
export interface UAOperationStateMachine_Base extends UAFiniteStateMachine_Base {
    configuredDefaultStopMode?: UABaseDataVariable<Int16, DataType.Int16>;
    /**
     * executing
     * Entity is in a condition of execution.
     */
    executing: UAState;
    /**
     * executingToIdle
     * Changes from Executing to Idle
     */
    executingToIdle: UATransition;
    /**
     * executingToReady
     * Changes from Executing to Ready
     */
    executingToReady: UATransition;
    /**
     * idle
     * Entity is not in a condition to start execution.
     */
    idle: UAState;
    /**
     * idleToIdle
     * Changes from Idle to Idle.
     */
    idleToIdle: UATransition;
    /**
     * idleToReady
     * Changes from Idle to Ready
     */
    idleToReady: UATransition;
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    possibleStopModes?: UABaseDataVariable<DTEnumValue[], DataType.ExtensionObject>;
    /**
     * ready
     * Entity is in a condition to start execution.
     */
    ready: UAState;
    /**
     * readyToExecuting
     * Changes from Ready to Executing
     */
    readyToExecuting: UATransition;
    /**
     * readyToIdle
     * Changes from Ready to Idle
     */
    readyToIdle: UATransition;
    start?: UAMethod;
    stop?: UAMethod;
}
export interface UAOperationStateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAOperationStateMachine_Base {
}