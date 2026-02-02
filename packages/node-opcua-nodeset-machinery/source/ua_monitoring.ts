// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health"
import { UAMachineryItemState_StateMachine } from "./ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "./ua_machinery_operation_mode_state_machine"
import { UABasicStacklight } from "node-opcua-nodeset-ia/dist/ua_basic_stacklight"
export interface UAMonitoring_health extends UAFolder { // Object
      deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
      deviceHealthAlarms?: UAFolder;
}
export interface UAMonitoring_status extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
      stacklight?: UABasicStacklight;
}
/**
 * Entry point for monitoring information of a
 * MachineryItem.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MonitoringType i=1014                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAMonitoring_Base extends UAFolder_Base {
    /**
     * consumption
     * Entry point for consumption information of the
     * MachineryItem.
     */
    consumption?: UAFolder;
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * health
     * Entry point of health information of the
     * MachineryItem.
     */
    health?: UAMonitoring_health;
    /**
     * process
     * Entry point for process information of the
     * MachineryItem.
     */
    process?: UAFolder;
    /**
     * status
     * Entry point for status information of the
     * MachineryItem. If this Object is provided, and
     * the MachineryItemState is provided, it shall be
     * referenced. If this Object is provided and the
     * MachineryOperationMode is provided, it shall be
     * referenced.
     */
    status?: UAMonitoring_status;
}
export interface UAMonitoring extends UAFolder, UAMonitoring_Base {
}