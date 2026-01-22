// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group"
import { UAConfigurableObject } from "node-opcua-nodeset-di/dist/ua_configurable_object"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine"
import { UAPackMLBaseStateMachine } from "node-opcua-nodeset-pack-ml/dist/ua_pack_ml_base_state_machine"
import { UAStatistic } from "./ua_statistic"
import { UAProductionPreset } from "./ua_production_preset"
export interface UAScaleSystem_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * Represents a scale system and contains one or
 * more scales.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ScaleSystemType i=44                                        |
 * |isAbstract      |false                                                       |
 */
export interface UAScaleSystem_Base extends UAComponent_Base {
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAFunctionalGroup;
    machineryBuildingBlocks?: UAScaleSystem_machineryBuildingBlocks;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineryOperationModeStateMachine;
    /**
     * policy
     * Defines the legal guidelines that apply for the
     * scale or need to be complied by the scale.
     */
    policy?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    /**
     * processStateId
     * Contains an relating identification for the
     * occurring ProcessStateMessage.
     */
    processStateId?: UAProperty<UAString, DataType.String>;
    /**
     * processStateMessage
     * Contains the message of the current overall state
     * of the scale.
     */
    processStateMessage: UAProperty<LocalizedText, DataType.LocalizedText>;
    productionOutput?: UAStatistic;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
    resetGlobalStatistics?: UAMethod;
    /**
     * subDevices
     * The Scales must be a subtype of the
     * ScaleDeviceType but must not be from the same
     * type.
     */
    subDevices?: UAConfigurableObject;
    systemState?: UAPackMLBaseStateMachine;
}
export interface UAScaleSystem extends Omit<UAComponent, "identification">, UAScaleSystem_Base {
}