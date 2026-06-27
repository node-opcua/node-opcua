import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * The LADSDeviceStateMachineType state machine
 * represents the Device’s operation mode. It is
 * inspired by the AnalyserDeviceStateMachineType
 * from the Analyzer Devices Specification.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSDeviceStateMachineType i=1039                           |
 * |isAbstract      |false                                                       |
 */
export interface UALADSDeviceStateMachine_Base extends UAFiniteStateMachine_Base {
    gotoOperate?: UAMethod;
    gotoShutdown?: UAMethod;
    gotoSleep?: UAMethod;
    /**
     * operate
     * The Device is in Operating mode. The LADS Client
     * uses this mode for normal operation:
     * configuration, control and data collection.
     */
    operate: UAState;
    operateToShutdown: UATransition;
    operateToSleep: UATransition;
    /**
     * initialization
     * The Device is in its initializing sequence and
     * cannot perform any other task.
     */
    initialization: UAInitialState;
    initializationToOperate: UATransition;
    /**
     * shutdown
     * The Device is in its power-down sequence and
     * cannot perform any other Task.
     */
    shutdown: UAState;
    /**
     * sleep
     * The Device is still powered on and its OPC UA
     * Server is still running, but it is not ready to
     * perform any Tasks until it transitions to the
     * Operate state. This state can be used to
     * represent a PowerSave state where a Device may
     * shut down some of its Components, such as the GUI.
     */
    sleep: UAState;
    sleepToOperate: UATransition;
}
export interface UALADSDeviceStateMachine extends UAFiniteStateMachine, UALADSDeviceStateMachine_Base {}