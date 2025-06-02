// ----- this file has been automatically generated - do not edit
import { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device"
import { UAProductionPreset } from "./ua_production_preset"
/**
 * Represents a simple scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SimpleScaleType i=3                                         |
 * |isAbstract      |false                                                       |
 */
export interface UASimpleScale_Base extends UAScaleDevice_Base {
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
}
export interface UASimpleScale extends Omit<UAScaleDevice, "productionPreset">, UASimpleScale_Base {
}