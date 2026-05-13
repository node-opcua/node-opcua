import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

import type { UAAnalyserChannelLocalState } from "./ua_analyser_channel_local_state";
import type { UAAnalyserChannelMaintenanceState } from "./ua_analyser_channel_maintenance_state";
import type { UAAnalyserChannel_OperatingModeSubStateMachine } from "./ua_analyser_channel_operating_mode_sub_state_machine";
import type { UAAnalyserChannelOperatingState } from "./ua_analyser_channel_operating_state";

// ----- this file has been automatically generated - do not edit

/**
 * Contains a nested state model that defines the
 * top level states Operating, Local and Maintenance
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalyserChannelStateMachineType i=1007                      |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalyserChannelStateMachine_Base extends UAFiniteStateMachine_Base {
    operatingSubStateMachine: UAAnalyserChannel_OperatingModeSubStateMachine;
    localSubStateMachine?: UAFiniteStateMachine;
    maintenanceSubStateMachine?: UAFiniteStateMachine;
    /**
     * slaveMode
     * The AnalyserDevice is in Local or Maintenance
     * mode and all AnalyserChannels are in SlaveMode
     */
    slaveMode: UAInitialState;
    /**
     * operating
     * The AnalyserChannel is in the Operating mode.
     */
    operating: UAAnalyserChannelOperatingState;
    /**
     * local
     * The AnalyserChannel is in the Local mode. This
     * mode is normally used to perform local physical
     * maintenance on the analyser.
     */
    local: UAAnalyserChannelLocalState;
    /**
     * maintenance
     * The AnalyserChannel is in the Maintenance mode.
     * This mode is used to perform remote maintenance
     * on the analyser like firmware upgrade.
     */
    maintenance: UAAnalyserChannelMaintenanceState;
    slaveModeToOperatingTransition: UATransition;
    operatingToLocalTransition: UATransition;
    operatingToMaintenanceTransition: UATransition;
    localToOperatingTransition: UATransition;
    localToMaintenanceTransition: UATransition;
    maintenanceToOperatingTransition: UATransition;
    maintenanceToLocalTransition: UATransition;
    operatingToSlaveModeTransition: UATransition;
    localToSlaveModeTransition: UATransition;
    maintenanceToSlaveModeTransition: UATransition;
}
export interface UAAnalyserChannelStateMachine extends UAFiniteStateMachine, UAAnalyserChannelStateMachine_Base {}