// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTCurrencyUnit } from "node-opcua-nodeset-ua/dist/dt_currency_unit"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAProduct, UAProduct_Base } from "./ua_product"
export interface UASimpleProduct_unitPrice<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      currencyUnit: UAProperty<DTCurrencyUnit, DataType.ExtensionObject>;
}
/**
 * Represents a product of a simple scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SimpleProductType i=20                                      |
 * |isAbstract      |false                                                       |
 */
export interface UASimpleProduct_Base extends UAProduct_Base {
    containerId?: UAProperty<UAString, DataType.String>;
    unitPrice?: UASimpleProduct_unitPrice<any, any>;
}
export interface UASimpleProduct extends UAProduct, UASimpleProduct_Base {
}