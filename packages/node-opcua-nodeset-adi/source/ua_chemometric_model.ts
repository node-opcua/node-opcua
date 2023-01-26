// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |2:ChemometricModelType ns=2;i=2007                |
 * |dataType        |ByteString                                        |
 * |dataType Name   |Buffer ns=0;i=15                                  |
 * |isAbstract      |false                                             |
 */
export interface UAChemometricModel_Base<T extends Buffer>  extends UABaseDataVariable_Base<T, DataType.ByteString> {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
    creationDate: UAProperty<Date, DataType.DateTime>;
    modelDescription: UAProperty<LocalizedText, DataType.LocalizedText>;
   // PlaceHolder for $User_defined_Input_$
   // PlaceHolder for $User_defined_Output_$
}
export interface UAChemometricModel<T extends Buffer> extends UABaseDataVariable<T, DataType.ByteString>, UAChemometricModel_Base<T> {
}