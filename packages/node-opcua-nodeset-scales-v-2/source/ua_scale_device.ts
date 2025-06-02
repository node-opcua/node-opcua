// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UAConfigurableObject } from "node-opcua-nodeset-di/dist/ua_configurable_object"
import { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine"
import { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine"
import { UAMachineIdentification } from "node-opcua-nodeset-machinery/dist/ua_machine_identification"
import { UAPackMLBaseStateMachine } from "node-opcua-nodeset-pack-ml/dist/ua_pack_ml_base_state_machine"
import { DTWeight } from "./dt_weight"
import { UAWeightItem } from "./ua_weight_item"
import { UAStatistic } from "./ua_statistic"
import { UAProductionPreset } from "./ua_production_preset"
export interface UAScaleDevice_machineryBuildingBlocks extends UAFolder { // Object
      machineryItemState?: UAMachineryItemState_StateMachine;
      machineryOperationMode?: UAMachineryOperationModeStateMachine;
}
/**
 * Represents a scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ScaleDeviceType i=2                                         |
 * |isAbstract      |true                                                        |
 */
export interface UAScaleDevice_Base extends UAComponent_Base {
   // PlaceHolder for $ListOfWeighingRanges$
    allowedEngineeringUnits?: UAProperty<EUInformation[], DataType.ExtensionObject>;
    clearTare?: UAMethod;
    /**
     * currentWeight
     * Defines the current value that is measured at the
     * sensor at the current timestamp. Might be a
     * highly fluctuating value.
     */
    currentWeight: UAWeightItem<DTWeight>;
    /**
     * identification
     * Used to organize parameters for identification of
     * this TopologyElement
     */
    identification: UAMachineIdentification;
    machineryBuildingBlocks?: UAScaleDevice_machineryBuildingBlocks;
    machineryItemState?: UAMachineryItemState_StateMachine;
    machineryOperationMode?: UAMachineryOperationModeStateMachine;
    /**
     * materialClass
     * Defines the allowed material the scale may
     * measure. Only relevant for certain scales (e.g.
     * totalizing hopper scale or continuous scale)
     */
    materialClass?: UAProperty<LocalizedText, DataType.LocalizedText>;
    minimalWeight?: UAAnalogUnit<any, any>;
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
    processStateMessage?: UAProperty<LocalizedText, DataType.LocalizedText>;
    productionOutput?: UAStatistic;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
    /**
     * registeredWeight
     * Defines the last valid measurement that was
     * recorded and will be used for further processing.
     * This is the legal registered value of the scale.
     */
    registeredWeight?: UAWeightItem<DTWeight>;
    registerWeight?: UAMethod;
    setPresetTare?: UAMethod;
    setTare?: UAMethod;
    setZero?: UAMethod;
    state?: UAPackMLBaseStateMachine;
    subDevices?: UAConfigurableObject;
}
export interface UAScaleDevice extends Omit<UAComponent, "identification">, UAScaleDevice_Base {
}