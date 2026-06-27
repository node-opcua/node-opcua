import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DTNameNodeId } from "node-opcua-nodeset-amb/dist/dt_name_node_id";
import type { EnumMaintenanceMethodEnum } from "node-opcua-nodeset-amb/dist/enum_maintenance_method_enum";
import type { UAMaintenanceEventStateMachine } from "node-opcua-nodeset-amb/dist/ua_maintenance_event_state_machine";
import type { UAMaintenanceRequiredAlarm, UAMaintenanceRequiredAlarm_Base } from "node-opcua-nodeset-di/dist/ua_maintenance_required_alarm";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The MaintenanceTaskType shall be used to
 * implement instances of maintenance tasks
 * applicable at both the Device and Component
 * levels. Maintenance tasks include activities such
 * as periodic maintenance, cleaning, calibration,
 * and validation.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaintenanceTaskType i=1028                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAMaintenanceTask_Base extends UAMaintenanceRequiredAlarm_Base {
    startTask?: UAMethod;
    /**
     * lastExecutionDate
     * LastExecutionDate is the date when the Task was
     * last performed. Optional, as the Task may have
     * never run before.
     */
    lastExecutionDate?: UAProperty<Date, DataType.DateTime>;
    /**
     * recurrencePeriod
     * RecurrencePeriod is the period of repetition of
     * the Task, specified in milliseconds. Optional, as
     * not all Tasks have a recurrence period.
     */
    recurrencePeriod?: UAProperty<number, DataType.Double>;
    /**
     * lastOperatingTime
     * LastOperatingTime is the total amount of
     * operating time (as defined in Section 9.3 of EN
     * 13306-2017) in milliseconds (ms) by the Device at
     * the time of the last execution of the Task.
     */
    lastOperatingTime?: UAProperty<number, DataType.Double>;
    /**
     * nextOperatingTime
     * NextOperatingTime is the total amount of
     * operating time (as defined in Section 9.3 of EN
     * 13306-2017) in milliseconds (ms) by the Device
     * before the next execution of the Task.
     */
    nextOperatingTime?: UAProperty<number, DataType.Double>;
    /**
     * lastOperatingCycles
     * LastOperatingCycles is the number of cycles
     * during the operating time (as defined in Section
     * 9.3 of EN 13306-2017) recorded at the time of the
     * last execution of the Task.
     */
    lastOperatingCycles?: UAProperty<UInt32, DataType.UInt32>;
    /**
     * nextOperatingCycles
     * NextOperatingCycles is the number of cycles
     * during operating time (as defined in Section 9.3
     * of EN 13306-2017) to be completed before the next
     * execution of the Task.
     */
    nextOperatingCycles?: UAProperty<UInt32, DataType.UInt32>;
    stopTask?: UAMethod;
    resetTask?: UAMethod;
    /**
     * configurationChanged
     * The ConfigurationChanged provides information if
     * the configuration of the asset is planned to be
     * changed or has changed during the maintenance
     * activity.
     */
    configurationChanged?: UAProperty<boolean, DataType.Boolean>;
    /**
     * estimatedDowntime
     * The EstimatedDowntime provides the estimated time
     * the execution of the maintenance activity will
     * take. In case of replanning, it is allowed to
     * change the EstimatedDowntime. If during the
     * execution of the maintenance activity the
     * EstimatedDowntime can be adjusted (e.g., the
     * asset needs to be repaired because an inspection
     * found some issues) this should be done. Clients
     * can access the history of Events to receive the
     * information on the original estimates when the
     * maintenance activity started.
     */
    estimatedDowntime?: UAProperty<number, DataType.Double>;
    /**
     * maintenanceMethod
     * The MaintenanceMethod provides information about
     * the planned or used maintenance method. The
     * content may change during the different
     * MaintenanceStates. By accessing the history of
     * Events a Client can distinguish between the
     * planned and actual used maintenance method during
     * the maintenance activity.
     */
    maintenanceMethod?: UAProperty<EnumMaintenanceMethodEnum, DataType.Int32>;
    /**
     * maintenanceState
     * The MaintenanceState state-machine provides
     * information, whether a maintenance activity is
     * planned, currently in execution, of has been
     * executed.
     */
    maintenanceState: UAMaintenanceEventStateMachine;
    /**
     * maintenanceSupplier
     * The MaintenanceSupplier provides information on
     * the supplier that is planned to execute,
     * currently executing or has executed the
     * maintenance activity. The content may change
     * during the different MaintenanceStates. By
     * accessing the history of Events a Client can
     * distinguish between the planned and actual
     * supplier that executed the maintenance activity.
     * The value contains always a human-readable name
     * of the supplier and optionally references a Node
     * representing the supplier in the AddressSpace.
     */
    maintenanceSupplier?: UAProperty<DTNameNodeId, DataType.ExtensionObject>;
    /**
     * partsOfAssetReplaced
     * The PartsOfAssetReplaced provides information on
     * the parts of the assets that are planned to be
     * replaced during the maintenance activity,
     * currently in replacement or have been replaced,
     * depending on the different MaintenanceStates. The
     * content may change during the different
     * MaintenanceStates. By accessing the history of
     * Events a Client can distinguish between the
     * planned and actual parts of the assets replaced
     * during the maintenance activity. The value
     * contains always an array of a human-readable name
     * of the qualification of the parts of the asset to
     * be replaced and optionally references a Node
     * representing each part of the asset in the
     * AddressSpace.
     */
    partsOfAssetReplaced?: UAProperty<DTNameNodeId[], DataType.ExtensionObject>;
    /**
     * partsOfAssetServiced
     * The PartsOfAssetServiced provides information on
     * the parts of the assets that are planned to be
     * serviced during the maintenance activity,
     * currently serviced or have been serviced,
     * depending on the different MaintenanceStates. The
     * content may change during the different
     * MaintenanceStates. By accessing the history of
     * Events a Client can distinguish between the
     * planned and actual parts of the assets serviced
     * during the maintenance activity. The value
     * contains always an array of a human-readable name
     * of the qualification of the parts of the asset to
     * be serviced and optionally references a Node
     * representing the part of the asset in the
     * AddressSpace.
     */
    partsOfAssetServiced?: UAProperty<DTNameNodeId[], DataType.ExtensionObject>;
    /**
     * plannedDate
     * The PlannedDate provides the date for which the
     * maintenance activity has been scheduled.. In case
     * of replanning, it is allowed to change the
     * PlannedDate. However, it is not the intention
     * that the PlannedDate is modified because the
     * maintenance activity starts to get executed. If
     * the PlannedDate depends for example on the
     * operation hours of the asset, it might get
     * adapted depending on the passed operation hours.
     */
    plannedDate?: UAProperty<Date, DataType.DateTime>;
    /**
     * qualificationOfPersonnel
     * The QualificationOfPersonnel provides information
     * on the qualification of the personnel that is
     * planned to execute, currently executing or has
     * executed the maintenance activity. The content
     * may change during the different
     * MaintenanceStates. By accessing the history of
     * Events a Client can distinguish between the
     * planned and actual qualification of the personnel
     * that executed the maintenance activity. The value
     * contains always a human-readable name of the
     * qualification of the personnel and optionally
     * references a Node representing the qualification
     * of the personnel in the AddressSpace.
     */
    qualificationOfPersonnel?: UAProperty<DTNameNodeId, DataType.ExtensionObject>;
}
export interface UAMaintenanceTask extends UAMaintenanceRequiredAlarm, UAMaintenanceTask_Base {}