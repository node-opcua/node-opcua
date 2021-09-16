// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Int32, UInt16, SByte } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { DTAntennaNameIdPair } from "./dt_antenna_name_id_pair"
import { UAAutoIdDevice_diagnostics, UAAutoIdDevice_runtimeParameters, UAAutoIdDevice, UAAutoIdDevice_Base } from "./ua_auto_id_device"
export interface UARfidReaderDevice_diagnostics extends UAAutoIdDevice_diagnostics { // Object
      /**
       * lastAccess
       * Values of the last AutoID Identifier access.
       */
      lastAccess?: UAFunctionalGroup;
}
export interface UARfidReaderDevice_runtimeParameters extends UAAutoIdDevice_runtimeParameters { // Object
      /**
       * codeTypesRWData
       * Supported CodeTypes and selected CodeType for the
       * diagnostics value RWData.
       */
      codeTypesRWData?: UAMultiStateDiscrete<UInt32[], /*z*/DataType.UInt32>;
      /**
       * enableAntennas
       * Antennas that shall be used by the device for its
       * operation.
       */
      enableAntennas?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
      /**
       * minRssi
       * Lowest acceptable RSSI value.
       */
      minRssi?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
      /**
       * rfPower
       * Radio transmission power of the antenna.
       */
      rfPower?: UABaseDataVariable<SByte, /*z*/DataType.SByte>;
      /**
       * tagTypes
       * Expected tags in a multi-type environment.
       */
      tagTypes?: UAMultiStateDiscrete<UInt32[], /*z*/DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:RfidReaderDeviceType ns=3;i=1003                |
 * |isAbstract      |false                                             |
 */
export interface UARfidReaderDevice_Base extends UAAutoIdDevice_Base {
    antennaNames?: UAProperty<DTAntennaNameIdPair[], /*z*/DataType.ExtensionObject>;
    /**
     * diagnostics
     * Diagnostic data from AutoID Devices.
     */
    diagnostics?: UARfidReaderDevice_diagnostics;
    killTag?: UAMethod;
    /**
     * lastScanAntenna
     * ID of the antenna with which the last AutoID
     * Identifier was scanned.
     */
    lastScanAntenna?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    /**
     * lastScanRSSI
     * RSSI Value with which the last AutoID Identifier
     * was scanned.
     */
    lastScanRSSI?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    lockTag?: UAMethod;
    readTag?: UAMethod;
    runtimeParameters?: UARfidReaderDevice_runtimeParameters;
    scan?: UAMethod;
    setTagPassword?: UAMethod;
    writeTag?: UAMethod;
    writeTagID?: UAMethod;
}
export interface UARfidReaderDevice extends Omit<UAAutoIdDevice, "diagnostics"|"runtimeParameters"|"scan">, UARfidReaderDevice_Base {
}