import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component";
import type { UAConfigurableObject } from "node-opcua-nodeset-di/dist/ua_configurable_object";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAMachineryItemState_StateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_item_state_state_machine";
import type { UAMachineryOperationModeStateMachine } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine";
import type { UAPackMLBaseStateMachine } from "node-opcua-nodeset-pack-ml/dist/ua_pack_ml_base_state_machine";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { DTWeight } from "./dt_weight";
import type { UAProductionPreset } from "./ua_production_preset";
import type { UAStatistic } from "./ua_statistic";
import type { UAWeightItem } from "./ua_weight_item";

// ----- this file has been automatically generated - do not edit

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
    identification: UAFunctionalGroup;
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
export interface UAScaleDevice extends Omit<UAComponent, "identification">, UAScaleDevice_Base {}