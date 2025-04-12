// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalyserDeviceStateMachineType i=1002                       |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalyserDeviceStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * powerup
     * The AnalyserDevice is in its power-up sequence
     * and cannot perform any other task.
     */
    powerup: UAInitialState;
    /**
     * operating
     * The AnalyserDevice is in the Operating mode.
     */
    operating: UAState;
    /**
     * local
     * The AnalyserDevice is in the Local mode. This
     * mode is normally used to perform local physical
     * maintenance on the analyser.
     */
    local: UAState;
    /**
     * maintenance
     * The AnalyserDevice is in the Maintenance mode.
     * This mode is used to perform remote maintenance
     * on the analyser like firmware upgrade.
     */
    maintenance: UAState;
    /**
     * shutdown
     * The AnalyserDevice is in its power-down sequence
     * and cannot perform any other task.
     */
    shutdown: UAState;
    powerupToOperatingTransition: UATransition;
    operatingToLocalTransition: UATransition;
    operatingToMaintenanceTransition: UATransition;
    localToOperatingTransition: UATransition;
    localToMaintenanceTransition: UATransition;
    maintenanceToOperatingTransition: UATransition;
    maintenanceToLocalTransition: UATransition;
    operatingToShutdownTransition: UATransition;
    localToShutdownTransition: UATransition;
    maintenanceToShutdownTransition: UATransition;
}
export interface UAAnalyserDeviceStateMachine extends UAFiniteStateMachine, UAAnalyserDeviceStateMachine_Base {
}