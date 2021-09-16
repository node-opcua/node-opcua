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
export interface UACncPositionVariable_Base<T extends DTCncPosition/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    /**
     * actPos
     * Position current value.
     */
    actPos: UABaseDataVariable<number, /*z*/DataType.Double>;
    /**
     * cmdPos
     * Position setpoint value.
     */
    cmdPos: UABaseDataVariable<number, /*z*/DataType.Double>;
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
    /**
     * remDist
     * Remaining distance to go.
     */
    remDist: UABaseDataVariable<number, /*z*/DataType.Double>;
}
export interface UACncPositionVariable<T extends DTCncPosition/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UACncPositionVariable_Base<T /*B*/> {
}