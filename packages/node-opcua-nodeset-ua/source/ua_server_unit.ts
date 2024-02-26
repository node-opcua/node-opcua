// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAUnit, UAUnit_Base } from "./ua_unit"
import { EnumConversionLimitEnum } from "./enum_conversion_limit_enum"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerUnitType i=32447                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAServerUnit_Base extends UAUnit_Base {
    alternativeUnits?: UAObject;
    conversionLimit: UAProperty<EnumConversionLimitEnum, DataType.Int32>;
    coherentUnit?: UAUnit;
}
export interface UAServerUnit extends UAUnit, UAServerUnit_Base {
}