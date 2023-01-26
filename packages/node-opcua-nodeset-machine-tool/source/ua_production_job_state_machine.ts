// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UAProductionStateMachine, UAProductionStateMachine_Base } from "./ua_production_state_machine"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionJobStateMachineType ns=10;i=28       |
 * |isAbstract      |false                                             |
 */
export interface UAProductionJobStateMachine_Base extends UAProductionStateMachine_Base {
    aborted: UAState;
    abortedToInitializing: UATransition;
    ended: UAState;
    endedToInitializing: UATransition;
    initializing: UAInitialState;
    initializingToAborted: UATransition;
    initializingToRunning: UATransition;
    interrupted: UAState;
    interruptedToAborted: UATransition;
    interruptedToRunning: UATransition;
    running: UAState;
    runningToAborted: UATransition;
    runningToEnded: UATransition;
    runningToInterrupted: UATransition;
    runningToRunning: UATransition;
}
export interface UAProductionJobStateMachine extends Omit<UAProductionStateMachine, "aborted"|"abortedToInitializing"|"ended"|"endedToInitializing"|"initializing"|"initializingToAborted"|"initializingToRunning"|"interrupted"|"interruptedToAborted"|"interruptedToRunning"|"running"|"runningToAborted"|"runningToEnded"|"runningToInterrupted"|"runningToRunning">, UAProductionJobStateMachine_Base {
}