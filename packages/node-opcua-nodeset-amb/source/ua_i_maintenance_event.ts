// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { EnumMaintenanceMethodEnum } from "./enum_maintenance_method_enum"
import { DTNameNodeId } from "./dt_name_node_id"
import { UAMaintenanceEventStateMachine } from "./ua_maintenance_event_state_machine"
/**
 * Information on maintenance activities, should by
 * applied to conditions (ConditionType or subtypes)
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IMaintenanceEventType i=1012                                |
 * |isAbstract      |true                                                        |
 */
export interface UAIMaintenanceEvent_Base extends UABaseInterface_Base {
    /**
     * configurationChanged
     * Information if the configuration of the asset is
     * planned to be changed or has changed during the
     * maintenance activity. FALSE indicates no change,
     * and TRUE indicates a change. The content may
     * change during the different MaintenanceStates. By
     * accessing the history of Events a Client can
     * distinguish between the planned and actual
     * configuration changes during the maintenance
     * activity.
     */
    configurationChanged?: UAProperty<boolean, DataType.Boolean>;
    /**
     * estimatedDowntime
     * The estimated time the execution of the
     * maintenance activity will take. In case of
     * replanning, it is allowed to change the
     * EstimatedDowntime. If during the execution of the
     * maintenance activity the EstimatedDowntime can be
     * adjusted (e.g., the asset needs to be repaired
     * because an inspection found some issues) this
     * should be done. Clients can access the history of
     * Events to receive the information on the original
     * estimates when the maintenance activity started.
     */
    estimatedDowntime?: UAProperty<number, DataType.Double>;
    /**
     * maintenanceMethod
     * Information about the planned or used maintenance
     * method. The content may change during the
     * different MaintenanceStates. By accessing the
     * history of Events a Client can distinguish
     * between the planned and actual used maintenance
     * method during the maintenance activity.
     */
    maintenanceMethod?: UAProperty<EnumMaintenanceMethodEnum, DataType.Int32>;
    /**
     * maintenanceState
     * Information if the maintenance activity is still
     * planned, currently in execution, or has already
     * been executed.
     */
    maintenanceState: UAMaintenanceEventStateMachine;
    /**
     * maintenanceSupplier
     * Information on the supplier that is planned to
     * execute, currently executing or has executed the
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
     * Information on the parts of the assets that are
     * planned to be serviced during the maintenance
     * activity, currently serviced or have been
     * serviced, depending on the different
     * MaintenanceStates. The content may change during
     * the different MaintenanceStates. By accessing the
     * history of Events a Client can distinguish
     * between the planned and actual parts of the
     * assets serviced during the maintenance activity.
     * The value contains always an array of a
     * human-readable name of the qualification of the
     * parts of the asset to be serviced and optionally
     * references a Node representing the part of the
     * asset in the AddressSpace.
     */
    partsOfAssetReplaced?: UAProperty<DTNameNodeId[], DataType.ExtensionObject>;
    /**
     * partsOfAssetServiced
     * Information on the parts of the assets that are
     * planned to be serviced during the maintenance
     * activity, currently serviced or have been
     * serviced, depending on the different
     * MaintenanceStates. The content may change during
     * the different MaintenanceStates. By accessing the
     * history of Events a Client can distinguish
     * between the planned and actual parts of the
     * assets serviced during the maintenance activity.
     * The value contains always an array of a
     * human-readable name of the qualification of the
     * parts of the asset to be serviced and optionally
     * references a Node representing the part of the
     * asset in the AddressSpace.
     */
    partsOfAssetServiced?: UAProperty<DTNameNodeId[], DataType.ExtensionObject>;
    /**
     * plannedDate
     * Date for which the maintenance activity has been
     * scheduled. In case of replanning, it is allowed
     * to change the PlannedDate. However, it is not the
     * intention that the PlannedDate is modified
     * because the maintenance activity starts to get
     * executed. If the PlannedDate depends for example
     * on the operation hours of the asset, it might get
     * adapted depending on the passed operation hours.
     */
    plannedDate?: UAProperty<Date, DataType.DateTime>;
    /**
     * qualificationOfPersonnel
     * Information on the qualification of the personnel
     * that is planned to execute, currently executing
     * or has executed the maintenance activity. The
     * content may change during the different
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
export interface UAIMaintenanceEvent extends UABaseInterface, UAIMaintenanceEvent_Base {
}