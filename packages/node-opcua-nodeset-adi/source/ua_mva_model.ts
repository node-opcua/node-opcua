// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAChemometricModel, UAChemometricModel_Base } from "./ua_chemometric_model"
/**
 * Hold the descriptions of a mathematical process
 * and associated information to convert scaled data
 * into one or more process values.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |2:MVAModelType ns=2;i=2009                        |
 * |dataType        |ByteString                                        |
 * |dataType Name   |Buffer ns=0;i=15                                  |
 * |isAbstract      |false                                             |
 */
export interface UAMVAModel_Base<T extends Buffer/*j*/>  extends UAChemometricModel_Base<T/*h*/> {
    mainDataIndex: UAProperty<Int32, /*z*/DataType.Int32>;
}
export interface UAMVAModel<T extends Buffer/*j*/> extends Omit<UAChemometricModel<T/*k*/>, "$User_defined_Output_$">, UAMVAModel_Base<T /*B*/> {
}