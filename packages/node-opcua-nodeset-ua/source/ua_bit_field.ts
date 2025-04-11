// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTBitFieldDefinition } from "./dt_bit_field_definition"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |BitFieldType i=32431                                        |
 * |dataType        |Variant                                                     |
 * |dataType Name   |number i=28                                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |true                                                        |
 */
export interface UABitField_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    bitFieldsDefinitions: UAProperty<DTBitFieldDefinition[], DataType.ExtensionObject>;
   // PlaceHolder for $FieldName$
   // PlaceHolder for $OptionalFieldName$
}
export interface UABitField<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UABitField_Base<T, DT> {
}