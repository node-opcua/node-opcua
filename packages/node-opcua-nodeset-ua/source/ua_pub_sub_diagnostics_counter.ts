// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { EnumPubSubDiagnosticsCounterClassification } from "./enum_pub_sub_diagnostics_counter_classification"
import { EnumDiagnosticsLevel } from "./enum_diagnostics_level"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |PubSubDiagnosticsCounterType ns=0;i=19725         |
 * |dataType        |UInt32                                            |
 * |dataType Name   |UInt32 ns=0;i=7                                   |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsCounter_Base<T extends UInt32/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.UInt32> {
    active: UAProperty<boolean, /*z*/DataType.Boolean>;
    classification: UAProperty<EnumPubSubDiagnosticsCounterClassification, /*z*/DataType.Int32>;
    diagnosticsLevel: UAProperty<EnumDiagnosticsLevel, /*z*/DataType.Int32>;
    timeFirstChange?: UAProperty<Date, /*z*/DataType.DateTime>;
}
export interface UAPubSubDiagnosticsCounter<T extends UInt32/*j*/> extends UABaseDataVariable<T, /*n*/DataType.UInt32>, UAPubSubDiagnosticsCounter_Base<T /*B*/> {
}