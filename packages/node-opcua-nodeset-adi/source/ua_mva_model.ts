// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UAChemometricModel, UAChemometricModel_Base } from "./ua_chemometric_model"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MVAModelType i=2009                                         |
 * |dataType        |ByteString                                                  |
 * |dataType Name   |(Buffer | Buffer[]) i=15                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMVAModel_Base<T extends (Buffer | Buffer[])>  extends UAChemometricModel_Base<T> {
   // PlaceHolder for $User_defined_Output_$
    mainDataIndex: UAProperty<Int32, DataType.Int32>;
}
export interface UAMVAModel<T extends (Buffer | Buffer[])> extends Omit<UAChemometricModel<T>, "$User_defined_Output_$">, UAMVAModel_Base<T> {
}