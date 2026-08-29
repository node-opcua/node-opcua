import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { DTNumberRange } from "./dt_number_range.js";
import type { DTRange } from "./dt_range.js";
import type { UADataItem, UADataItem_Base } from "./ua_data_item.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |BaseAnalogType i=15318                                      |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UABaseAnalog_Base<T, DT extends DataType>  extends UADataItem_Base<T, DT> {
    instrumentRange?: UAProperty<DTRange, DataType.ExtensionObject>;
    instrumentNumberRange?: UAProperty<DTNumberRange, DataType.ExtensionObject>;
    euRange?: UAProperty<DTRange, DataType.ExtensionObject>;
    euNumberRange?: UAProperty<DTNumberRange, DataType.ExtensionObject>;
    engineeringUnits?: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UABaseAnalog<T, DT extends DataType> extends UADataItem<T, DT>, UABaseAnalog_Base<T, DT> {}