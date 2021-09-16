// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UACncDrive, UACncDrive_Base } from "./ua_cnc_drive"
import { DTCncPosition } from "./dt_cnc_position"
import { UACncPositionVariable } from "./ua_cnc_position_variable"
export interface UACncSpindle_actSpeed<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACncSpindle_cmdSpeed<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * CNC spindle component.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncSpindleType ns=11;i=1005                    |
 * |isAbstract      |false                                             |
 */
export interface UACncSpindle_Base extends UACncDrive_Base {
    /**
     * actGear
     * Gear stage actual value.
     */
    actGear: UADataItem<UInt32, /*z*/DataType.UInt32>;
    /**
     * actOverride
     * Override actual value.
     */
    actOverride: UAAnalogItem<number, /*z*/DataType.Double>;
    /**
     * actSpeed
     * Speed actual value.
     */
    actSpeed: UACncSpindle_actSpeed<number, /*z*/DataType.Double>;
    /**
     * actStatus
     * Actual spindle state.
     */
    actStatus: UADataItem<any, any>;
    /**
     * actTurnDirection
     * Turn direction actual value.
     */
    actTurnDirection: UADataItem<any, any>;
    /**
     * anglePos
     * Spindle angular position values in case of
     * interpolated (position controlled) spindle
     * movement. Returns zeros in case of regular
     * spindle operation (velocity controlled).
     */
    anglePos: UACncPositionVariable<DTCncPosition>;
    /**
     * cmdGear
     * Gear stage setpoint value.
     */
    cmdGear: UADataItem<UInt32, /*z*/DataType.UInt32>;
    /**
     * cmdOverride
     * Override setpoint value.
     */
    cmdOverride: UAAnalogItem<number, /*z*/DataType.Double>;
    /**
     * cmdSpeed
     * Speed setpoint value.
     */
    cmdSpeed: UACncSpindle_cmdSpeed<number, /*z*/DataType.Double>;
}
export interface UACncSpindle extends UACncDrive, UACncSpindle_Base {
}