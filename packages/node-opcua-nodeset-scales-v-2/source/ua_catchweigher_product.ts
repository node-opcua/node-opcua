// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAProduct, UAProduct_Base } from "./ua_product"
import { UAWeighingItem } from "./ua_weighing_item"
import { UATargetItem } from "./ua_target_item"
/**
 * Represents a product of a Catchweigher.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CatchweigherProductType i=17                                |
 * |isAbstract      |false                                                       |
 */
export interface UACatchweigherProduct_Base extends UAProduct_Base {
   // PlaceHolder for $Zones$
    addZone?: UAMethod;
    lastItem?: UAWeighingItem;
    /**
     * presetHeight
     * Defines the predefined height (in direction of
     * global gravity) of the measured item. The value
     * must be write before the item is measured.
     */
    presetHeight?: UAAnalogUnit<any, any>;
    /**
     * presetLength
     * Defines the predefined length (in direction of
     * travel) of the measured item. The value must be
     * written before the item is measured.
     */
    presetLength?: UAAnalogUnit<any, any>;
    /**
     * presetWidth
     * Defines the predefined width (in third possible
     * orthogonal direction to height and length) of the
     * measured item. The value must be write before the
     * item is measured.
     */
    presetWidth?: UAAnalogUnit<any, any>;
    removeZone?: UAMethod;
    targetThroughput?: UATargetItem<any, any>;
}
export interface UACatchweigherProduct extends UAProduct, UACatchweigherProduct_Base {
}