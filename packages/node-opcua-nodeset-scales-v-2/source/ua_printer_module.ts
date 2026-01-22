// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine"
export interface UAPrinterModule_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * Represents a printing device. A printing device
 * is a subdevice of a scale, that prints labels or
 * other documents releated to the scale or the
 * measurement results.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PrinterModuleType i=29                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAPrinterModule_Base extends UAComponent_Base {
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAFunctionalGroup;
    /**
     * labelLength
     * Defines the length of the labels in stock.
     */
    labelLength?: UAAnalogUnit<any, any>;
    /**
     * labelStock
     * Indicates the level of labels in stock in percent.
     */
    labelStock?: UAAnalogItem<any, any>;
    /**
     * labelTypeId
     * Defines the Id of the label to be printed.
     */
    labelTypeId?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * labelWidth
     * Defines the width of the labels in stock.
     */
    labelWidth?: UAAnalogUnit<any, any>;
    machineryBuildingBlocks?: UAPrinterModule_machineryBuildingBlocks;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineryOperationModeStateMachine;
    /**
     * printMediaStock
     * Defines the level of the print media in percent
     * (e.g. ink, wear of thermal element, etc)
     */
    printMediaStock?: UAAnalogItem<any, any>;
}
export interface UAPrinterModule extends Omit<UAComponent, "identification">, UAPrinterModule_Base {
}