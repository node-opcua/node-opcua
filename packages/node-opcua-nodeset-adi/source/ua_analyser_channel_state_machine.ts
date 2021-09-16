// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAAnalyserChannel_OperatingModeSubStateMachine } from "./ua_analyser_channel_operating_mode_sub_state_machine"
import { UAAnalyserChannelOperatingState } from "./ua_analyser_channel_operating_state"
import { UAAnalyserChannelLocalState } from "./ua_analyser_channel_local_state"
import { UAAnalyserChannelMaintenanceState } from "./ua_analyser_channel_maintenance_state"
/**
 * Contains a nested state model that defines the
 * top level states Operating, Local and Maintenance
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AnalyserChannelStateMachineType ns=2;i=1007     |
 * |isAbstract      |false                                             |
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
export interface UAAnalyserChannelStateMachine extends UAFiniteStateMachine, UAAnalyserChannelStateMachine_Base {
}