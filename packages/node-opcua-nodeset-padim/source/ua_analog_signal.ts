// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UAAnalogSignalVariable } from "./ua_analog_signal_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:AnalogSignalType ns=20;i=1022                  |
 * |isAbstract      |false                                             |
 */
export interface UAAnalogSignal_Base extends UASignal_Base {
    zeroPointAdjustment?: UAMethod;
    analogSignal: UAAnalogSignalVariable<any, any>;
}
export interface UAAnalogSignal extends UASignal, UAAnalogSignal_Base {
}