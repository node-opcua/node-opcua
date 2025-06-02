// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTCurrencyUnit } from "node-opcua-nodeset-ua/dist/dt_currency_unit"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UACatchweigherProduct, UACatchweigherProduct_Base } from "./ua_catchweigher_product"
import { UAPriceItem } from "./ua_price_item"
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
    lastItem?: UAPriceItem;
    /**
     * unitPrice
     * Defines the price per weight unit.
     */
    unitPrice?: UAAutomaticWeightPriceLabelerProduct_unitPrice<any, any>;
}
export interface UAAutomaticWeightPriceLabelerProduct extends Omit<UACatchweigherProduct, "lastItem">, UAAutomaticWeightPriceLabelerProduct_Base {
}