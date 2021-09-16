// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
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
    abortedToInitializing: UATransition;
    endedToInitializing: UATransition;
    initializingToAborted: UATransition;
    initializingToRunning: UATransition;
    interruptedToAborted: UATransition;
    interruptedToRunning: UATransition;
    runningToAborted: UATransition;
    runningToEnded: UATransition;
    runningToInterrupted: UATransition;
    runningToRunning: UATransition;
}
export interface UAProductionJobStateMachine extends Omit<UAProductionStateMachine, "abortedToInitializing"|"endedToInitializing"|"initializingToAborted"|"initializingToRunning"|"interruptedToAborted"|"interruptedToRunning"|"runningToAborted"|"runningToEnded"|"runningToInterrupted"|"runningToRunning">, UAProductionJobStateMachine_Base {
}