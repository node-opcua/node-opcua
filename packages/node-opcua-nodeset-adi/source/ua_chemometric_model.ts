// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ChemometricModelType i=2007                                 |
 * |dataType        |ByteString                                                  |
 * |dataType Name   |(Buffer | Buffer[]) i=15                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAChemometricModel_Base<T extends (Buffer | Buffer[])>  extends UABaseDataVariable_Base<T, DataType.ByteString> {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
    creationDate: UAProperty<Date, DataType.DateTime>;
    modelDescription: UAProperty<LocalizedText, DataType.LocalizedText>;
   // PlaceHolder for $User_defined_Input_$
   // PlaceHolder for $User_defined_Output_$
}
export interface UAChemometricModel<T extends (Buffer | Buffer[])> extends UABaseDataVariable<T, DataType.ByteString>, UAChemometricModel_Base<T> {
}