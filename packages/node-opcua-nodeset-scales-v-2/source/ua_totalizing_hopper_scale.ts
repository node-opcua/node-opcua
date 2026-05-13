import type { UAProductionPreset } from "./ua_production_preset";
import type { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a totalizing hopper scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TotalizingHopperScaleType i=8                               |
 * |isAbstract      |false                                                       |
 */
export interface UATotalizingHopperScale_Base extends UAScaleDevice_Base {
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
}
export interface UATotalizingHopperScale extends Omit<UAScaleDevice, "productionPreset">, UATotalizingHopperScale_Base {}