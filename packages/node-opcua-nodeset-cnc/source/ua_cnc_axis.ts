// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UACncDrive, UACncDrive_Base } from "./ua_cnc_drive"
import { DTCncPosition } from "./dt_cnc_position"
import { UACncPositionVariable } from "./ua_cnc_position_variable"
export interface UACncAxis_zeroOffset<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * CNC axis component.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncAxisType ns=11;i=1004                       |
 * |isAbstract      |false                                             |
 */
export interface UACncAxis_Base extends UACncDrive_Base {
    /**
     * actStatus
     * Actual axis state.
     */
    actStatus: UADataItem<any, any>;
    /**
     * isReferenced
     * Axis reference state (true in case of
     * successfully refereneced axis, else false).
     */
    isReferenced: UADataItem<boolean, /*z*/DataType.Boolean>;
    /**
     * isRotational
     * Axis type (true in case of rotational axis, in
     * case of linear type or other false).
     */
    isRotational: UADataItem<boolean, /*z*/DataType.Boolean>;
    /**
     * posDirect
     * Position actual value referring to axis' direct
     * measurement system.
     */
    posDirect: UACncPositionVariable<DTCncPosition>;
    /**
     * posIndirect
     * Position actual value referring to axis' indirect
     * measurement system.
     */
    posIndirect: UACncPositionVariable<DTCncPosition>;
    /**
     * zeroOffset
     * Active axis zero offset.
     */
    zeroOffset: UACncAxis_zeroOffset<number, /*z*/DataType.Double>;
}
export interface UACncAxis extends UACncDrive, UACncAxis_Base {
}