// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAFiniteStateVariable } from "node-opcua-nodeset-ua/source/ua_finite_state_variable"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAProductionPartStateMachine } from "./ua_production_part_state_machine"
export interface UAProductionPart_state extends Omit<UAProductionPartStateMachine, "abortedToInitializing"|"currentState"|"endedToInitializing"|"initializingToAborted"|"initializingToRunning"|"interruptedToAborted"|"interruptedToRunning"|"runningToAborted"|"runningToEnded"|"runningToInterrupted"|"runningToRunning"> { // Object
      abortedToInitializing: UATransition;
      currentState: UAFiniteStateVariable<LocalizedText>;
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
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionPartType ns=10;i=56                  |
 * |isAbstract      |false                                             |
 */
export interface UAProductionPart_Base {
    customerOrderIdentifier?: UAProperty<UAString, /*z*/DataType.String>;
    identifier?: UAProperty<UAString, /*z*/DataType.String>;
    name: UAProperty<UAString, /*z*/DataType.String>;
    partQuality: UABaseDataVariable<any, any>;
    processIrregularity: UABaseDataVariable<any, any>;
    state?: UAProductionPart_state;
}
export interface UAProductionPart extends UAObject, UAProductionPart_Base {
}