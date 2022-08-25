// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTCncPosition } from "./dt_cnc_position"
/**
 * Group of position values.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |11:CncPositionVariableType ns=11;i=2001           |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTCncPosition ns=11;i=3007                        |
 * |isAbstract      |false                                             |
 */
export interface UACncPositionVariable_Base<T extends DTCncPosition>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * actPos
     * Position current value.
     */
    actPos: UABaseDataVariable<number, DataType.Double>;
    /**
     * cmdPos
     * Position setpoint value.
     */
    cmdPos: UABaseDataVariable<number, DataType.Double>;
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
    euRange: UAProperty<DTRange, DataType.ExtensionObject>;
    /**
     * remDist
     * Remaining distance to go.
     */
    remDist: UABaseDataVariable<number, DataType.Double>;
}
export interface UACncPositionVariable<T extends DTCncPosition> extends UABaseDataVariable<T, DataType.ExtensionObject>, UACncPositionVariable_Base<T> {
}