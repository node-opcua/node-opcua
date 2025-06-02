// ----- this file has been automatically generated - do not edit
import { UACatchweigher, UACatchweigher_Base } from "./ua_catchweigher"
import { UAProductionPreset } from "./ua_production_preset"
/**
 * Represents an automatic weight-price-labeler.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomaticWeightPriceLabelerType i=49                        |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomaticWeightPriceLabeler_Base extends UACatchweigher_Base {
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
}
export interface UAAutomaticWeightPriceLabeler extends Omit<UACatchweigher, "productionPreset">, UAAutomaticWeightPriceLabeler_Base {
}