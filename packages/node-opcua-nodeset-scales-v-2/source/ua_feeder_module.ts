// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_identification"
import { UAMeasuredItem } from "./ua_measured_item"
import { UATargetItem } from "./ua_target_item"
export interface UAFeederModule_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * Represents a feeder system. A feeder system is a
 * subdevice of an automatic scale for conveying the
 * product to or from the WeighingBridge.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FeederModuleType i=28                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAFeederModule_Base extends UAComponent_Base {
    /**
     * feederLoad
     * Defines the current loaded weight on the feeder
     * system.
     */
    feederLoad?: UAMeasuredItem<any, any>;
    /**
     * feederRunning
     * Indicates that the feeder system is running.
     */
    feederRunning?: UAProperty<boolean, DataType.Boolean>;
    /**
     * feederSpeed
     * Defines the current speed of a feeder system. The
     * unit of the FeederSpeed depends on the
     * construction system.
     */
    feederSpeed?: UATargetItem<any, any>;
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAMachineryItemIdentification;
    machineryBuildingBlocks?: UAFeederModule_machineryBuildingBlocks;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineryOperationModeStateMachine;
    /**
     * maximumFeederSpeed
     * Defines the maximal possible speed of the feeder.
     */
    maximumFeederSpeed?: UAAnalogUnit<any, any>;
    /**
     * minimalFeederSpeed
     * Defines the minimal possible speed of the feeder.
     */
    minimalFeederSpeed?: UAAnalogUnit<any, any>;
    setFeederSpeed?: UAMethod;
}
export interface UAFeederModule extends Omit<UAComponent, "identification">, UAFeederModule_Base {
}