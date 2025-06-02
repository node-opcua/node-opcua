// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device"
import { UAMeasuredItem } from "./ua_measured_item"
import { UAProductionPreset } from "./ua_production_preset"
/**
 * Represents a piece counting scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PieceCountingScaleType i=6                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAPieceCountingScale_Base extends UAScaleDevice_Base {
    /**
     * currentPieceCount
     * Defines the number of pieces that are currently
     * measured related to the ReferencePieceWeight.
     */
    currentPieceCount: UAMeasuredItem<any, any>;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
    /**
     * referenceOptimisationRange
     * Defines the tolerance range within the scale may
     * optimize the ReferencePieceWeight.
     */
    referenceOptimisationRange?: UAAnalogItem<any, any>;
    setNumberOfReferencePieces: UAMethod;
    setReferencePieceWeight: UAMethod;
    startReference?: UAMethod;
}
export interface UAPieceCountingScale extends Omit<UAScaleDevice, "productionPreset">, UAPieceCountingScale_Base {
}