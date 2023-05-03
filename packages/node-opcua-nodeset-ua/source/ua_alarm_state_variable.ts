// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { DTContentFilter } from "./dt_content_filter"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AlarmStateVariableType i=32244                              |
 * |dataType        |UInt16                                                      |
 * |dataType Name   |UInt16 i=32251                                              |
 * |isAbstract      |false                                                       |
 */
export interface UAAlarmStateVariable_Base<T extends UInt16>  extends UABaseDataVariable_Base<T, DataType.UInt16> {
    highestActiveSeverity: UAProperty<UInt16, DataType.UInt16>;
    highestUnackSeverity: UAProperty<UInt16, DataType.UInt16>;
    activeCount: UAProperty<UInt32, DataType.UInt32>;
    unacknowledgedCount: UAProperty<UInt32, DataType.UInt32>;
    unconfirmedCount: UAProperty<UInt32, DataType.UInt32>;
    filter: UAProperty<DTContentFilter, DataType.ExtensionObject>;
}
export interface UAAlarmStateVariable<T extends UInt16> extends UABaseDataVariable<T, DataType.UInt16>, UAAlarmStateVariable_Base<T> {
}