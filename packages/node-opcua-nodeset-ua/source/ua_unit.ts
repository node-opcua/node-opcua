import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |UnitType i=32442                                            |
 * |isAbstract      |true                                                        |
 */
export interface UAUnit_Base {
    symbol: UAProperty<LocalizedText, DataType.LocalizedText>;
    unitSystem: UAProperty<UAString, DataType.String>;
    discipline?: UAProperty<UAString, DataType.String>;
}
export interface UAUnit extends UAObject, UAUnit_Base {}