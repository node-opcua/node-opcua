import type { UAProperty } from "node-opcua-address-space-base";
import type { DTCurrencyUnit } from "node-opcua-nodeset-ua/dist/dt_currency_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UACatchweigherProduct, UACatchweigherProduct_Base } from "./ua_catchweigher_product";
import type { UAWeighingItem } from "./ua_weighing_item";

// ----- this file has been automatically generated - do not edit

export interface UAAutomaticWeightPriceLabelerProduct_unitPrice<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      currencyUnit: UAProperty<DTCurrencyUnit, DataType.ExtensionObject>;
}
/**
 * Represents a product of a automatic
 * weight-price-labeler.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomaticWeightPriceLabelerProductType i=47                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomaticWeightPriceLabelerProduct_Base extends UACatchweigherProduct_Base {
    lastItem?: UAWeighingItem;
    /**
     * unitPrice
     * Defines the price per weight unit.
     */
    unitPrice?: UAAutomaticWeightPriceLabelerProduct_unitPrice<any, any>;
}
export interface UAAutomaticWeightPriceLabelerProduct extends Omit<UACatchweigherProduct, "lastItem">, UAAutomaticWeightPriceLabelerProduct_Base {}