// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { EnumPubSubDiagnosticsCounterClassification } from "./enum_pub_sub_diagnostics_counter_classification"
import { EnumDiagnosticsLevel } from "./enum_diagnostics_level"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |PubSubDiagnosticsCounterType i=19725                        |
 * |dataType        |UInt32                                                      |
 * |dataType Name   |UInt32 i=7                                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsCounter_Base<T extends UInt32>  extends UABaseDataVariable_Base<T, DataType.UInt32> {
    active: UAProperty<boolean, DataType.Boolean>;
    classification: UAProperty<EnumPubSubDiagnosticsCounterClassification, DataType.Int32>;
    diagnosticsLevel: UAProperty<EnumDiagnosticsLevel, DataType.Int32>;
    timeFirstChange?: UAProperty<Date, DataType.DateTime>;
}
export interface UAPubSubDiagnosticsCounter<T extends UInt32> extends UABaseDataVariable<T, DataType.UInt32>, UAPubSubDiagnosticsCounter_Base<T> {
}