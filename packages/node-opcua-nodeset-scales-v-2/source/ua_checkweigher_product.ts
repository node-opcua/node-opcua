// ----- this file has been automatically generated - do not edit
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UACatchweigherProduct, UACatchweigherProduct_Base } from "./ua_catchweigher_product"
import { UATargetItem } from "./ua_target_item"
import { UACheckweigherStatistic } from "./ua_checkweigher_statistic"
/**
 * Represents a product of a Checkweigher.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CheckweigherProductType i=46                                |
 * |isAbstract      |false                                                       |
 */
export interface UACheckweigherProduct_Base extends UACatchweigherProduct_Base {
    lowerToleranceLimit1?: UAAnalogUnit<any, any>;
    lowerToleranceLimit2?: UAAnalogUnit<any, any>;
    /**
     * nominalWeight
     * Defines the nominal (printed) weight of the
     * product.
     */
    nominalWeight: UATargetItem<any, any>;
    /**
     * statistic
     * Contains the different statistic values of the
     * product.
     */
    statistic?: UACheckweigherStatistic;
}
export interface UACheckweigherProduct extends Omit<UACatchweigherProduct, "statistic">, UACheckweigherProduct_Base {
}