// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
/**
 * State machine representing the operation mode of
 * a MachineryItem
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineryOperationModeStateMachineType ns=8;i=1008|
 * |isAbstract      |false                                             |
 */
export interface UAMachineryOperationModeStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * fromMaintenanceToMaintenance
     * Transition from state Maintenance to state
     * Maintenance
     */
    fromMaintenanceToMaintenance: UATransition;
    /**
     * fromMaintenanceToNone
     * Transition from state Maintenance to state None
     */
    fromMaintenanceToNone: UATransition;
    /**
     * fromMaintenanceToProcessing
     * Transition from state Maintenance to state
     * Processing
     */
    fromMaintenanceToProcessing: UATransition;
    /**
     * fromMaintenanceToSetup
     * Transition from state Maintenance to state Setup
     */
    fromMaintenanceToSetup: UATransition;
    /**
     * fromNoneToMaintenance
     * Transition from state None to state Maintenance
     */
    fromNoneToMaintenance: UATransition;
    /**
     * fromNoneToNone
     * Transition from state None to state None
     */
    fromNoneToNone: UATransition;
    /**
     * fromNoneToProcessing
     * Transition from state None to state Processing
     */
    fromNoneToProcessing: UATransition;
    /**
     * fromNoneToSetup
     * Transition from state None to state Setup
     */
    fromNoneToSetup: UATransition;
    /**
     * fromProcessingToMaintenance
     * Transition from state Processing to state
     * Maintenance
     */
    fromProcessingToMaintenance: UATransition;
    /**
     * fromProcessingToNone
     * Transition from state Processing to state None
     */
    fromProcessingToNone: UATransition;
    /**
     * fromProcessingToProcessing
     * Transition from state Processing to state
     * Processing
     */
    fromProcessingToProcessing: UATransition;
    /**
     * fromProcessingToSetup
     * Transition from state Processing to state Setup
     */
    fromProcessingToSetup: UATransition;
    /**
     * fromSetupToMaintenance
     * Transition from state Setup to state Maintenance
     */
    fromSetupToMaintenance: UATransition;
    /**
     * fromSetupToNone
     * Transition from state Setup to state None
     */
    fromSetupToNone: UATransition;
    /**
     * fromSetupToProcessing
     * Transition from state Setup to state Processing
     */
    fromSetupToProcessing: UATransition;
    /**
     * fromSetupToSetup
     * Transition from state Setup to state Setup
     */
    fromSetupToSetup: UATransition;
    /**
     * maintenance
     * MachineryItem is set into maintenance mode with
     * the intention to carry out maintenance or
     * servicing activities
     */
    maintenance: UAState;
    /**
     * none
     * There is currently no operation mode available
     */
    none: UAState;
    /**
     * processing
     * MachineryItem is set into processing mode with
     * the intention to carry out the value adding
     * activities
     */
    processing: UAState;
    /**
     * setup
     * MachineryItem is set into setup mode with the
     * intention to carry out setup, preparation or
     * postprocessing activities of a production process
     */
    setup: UAState;
}
export interface UAMachineryOperationModeStateMachine extends UAFiniteStateMachine, UAMachineryOperationModeStateMachine_Base {
}