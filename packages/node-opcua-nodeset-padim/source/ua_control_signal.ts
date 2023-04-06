// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UAControlVariable } from "./ua_control_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:ControlSignalType ns=20;i=1023                 |
 * |isAbstract      |false                                             |
 */
export interface UAControlSignal_Base extends UASignal_Base {
    autoAdjustPositioner?: UAMethod;
    controlSignal: UAControlVariable<number>;
}
export interface UAControlSignal extends UASignal, UAControlSignal_Base {
}