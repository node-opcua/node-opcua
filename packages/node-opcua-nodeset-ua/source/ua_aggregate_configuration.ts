// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AggregateConfigurationType i=11187                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAggregateConfiguration_Base {
    treatUncertainAsBad: UAProperty<boolean, DataType.Boolean>;
    percentDataBad: UAProperty<Byte, DataType.Byte>;
    percentDataGood: UAProperty<Byte, DataType.Byte>;
    useSlopedExtrapolation: UAProperty<boolean, DataType.Boolean>;
}
export interface UAAggregateConfiguration extends UAObject, UAAggregateConfiguration_Base {
}