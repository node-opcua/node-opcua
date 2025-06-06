// ----- this file has been automatically generated - do not edit
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAProductionStateMachine, UAProductionStateMachine_Base } from "./ua_production_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionPartStateMachineType i=40                         |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionPartStateMachine_Base extends UAProductionStateMachine_Base {
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
export interface UAProductionPartStateMachine extends Omit<UAProductionStateMachine, "aborted"|"abortedToInitializing"|"ended"|"endedToInitializing"|"initializing"|"initializingToAborted"|"initializingToRunning"|"interrupted"|"interruptedToAborted"|"interruptedToRunning"|"running"|"runningToAborted"|"runningToEnded"|"runningToInterrupted"|"runningToRunning">, UAProductionPartStateMachine_Base {
}