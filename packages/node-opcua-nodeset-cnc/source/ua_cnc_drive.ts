// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UACncComponent, UACncComponent_Base } from "./ua_cnc_component"
export interface UACncDrive_actLoad<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncDrive_actPower<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncDrive_actTorque<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACncDrive_cmdTorque<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * Base component for CNC specific drive componentes
 * (e.g. axis or spindle).
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncDriveType ns=11;i=1003                      |
 * |isAbstract      |true                                              |
 */
export interface UACncDrive_Base extends UACncComponent_Base {
    /**
     * actChannel
     * NodeId of the channel object (CncChannelType)
     * that administrates this drive to expose drive’s
     * channel affiliation.
     */
    actChannel: UADataItem<NodeId, DataType.NodeId>;
    /**
     * actLoad
     * Drive load actual value.
     */
    actLoad: UACncDrive_actLoad<number, DataType.Double>;
    /**
     * actPower
     * Drive power actual value.
     */
    actPower: UACncDrive_actPower<number, DataType.Double>;
    /**
     * actTorque
     * Drive torque actual value.
     */
    actTorque: UACncDrive_actTorque<number, DataType.Double>;
    /**
     * cmdTorque
     * Drive torque setpoint value.
     */
    cmdTorque: UACncDrive_cmdTorque<number, DataType.Double>;
    /**
     * isInactive
     * Drive inactive state (true in case of inactive
     * drive, else false).
     */
    isInactive: UADataItem<boolean, DataType.Boolean>;
    /**
     * isVirtual
     * Virtual axis (no hardware present; true in case
     * of virtual axis, else fals).
     */
    isVirtual: UADataItem<boolean, DataType.Boolean>;
}
export interface UACncDrive extends UACncComponent, UACncDrive_Base {
}