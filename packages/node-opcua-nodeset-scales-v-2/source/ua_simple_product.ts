import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTCurrencyUnit } from "node-opcua-nodeset-ua/dist/dt_currency_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAProduct, UAProduct_Base } from "./ua_product";

// ----- this file has been automatically generated - do not edit

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
export interface UASimpleProduct extends UAProduct, UASimpleProduct_Base {}