import type { UAProductionPreset } from "./ua_production_preset.js";
import type { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device.js";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a Catchweigher. It has no method or
 * properties defined.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CatchweigherType i=4                                        |
 * |isAbstract      |false                                                       |
 */
export interface UACatchweigher_Base extends UAScaleDevice_Base {
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
}
export interface UACatchweigher extends Omit<UAScaleDevice, "productionPreset">, UACatchweigher_Base {}