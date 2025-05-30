// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Int32, UInt16, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/dist/ua_device"
import { DTLocation } from "./dt_location"
import { EnumDeviceStatus } from "./enum_device_status"
import { UALocationVariable } from "./ua_location_variable"
export interface UAAutoIdDevice_diagnostics extends UAFunctionalGroup { // Object
      /**
       * lastAccess
       * Values of the last AutoID Identifier access.
       */
      lastAccess?: UAFunctionalGroup;
      /**
       * logbook
       * Values of the logbook.
       */
      logbook?: UAFunctionalGroup;
      /**
       * presence
       * Current presence of AutoID Identifier (e.g. a
       * code or a transponder).
       */
      presence?: UABaseDataVariable<UInt16, DataType.UInt16>;
}
export interface UAAutoIdDevice_runtimeParameters extends UAFunctionalGroup { // Object
      /**
       * codeTypes
       * Supported CodeTypes and selected CodeType for the
       * ScanData.
       */
      codeTypes?: UAMultiStateDiscrete<UInt32[], DataType.UInt32>;
      /**
       * scanSettings
       * Scan settings used together with ScanActive
       * Variable.
       */
      scanSettings?: UAFunctionalGroup;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutoIdDeviceType i=1001                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAutoIdDevice_Base extends UADevice_Base {
    autoIdModelVersion: UAProperty<UAString, DataType.String>;
    /**
     * deviceInfo
     * Device status information.
     */
    deviceInfo?: UAProperty<UAString, DataType.String>;
    /**
     * deviceLocation
     * Union of GPS, UTM, Local.
     */
    deviceLocation?: UALocationVariable<DTLocation>;
    /**
     * deviceLocationName
     * Symbolic name of the device location.
     */
    deviceLocationName?: UAProperty<UAString, DataType.String>;
    /**
     * deviceName
     * Default could be also host name, IP address or
     * MAC. This should be a field that can be
     * configured for a device.
     */
    deviceName: UAProperty<UAString, DataType.String>;
    deviceStatus: UABaseDataVariable<EnumDeviceStatus, DataType.Int32>;
    /**
     * diagnostics
     * Diagnostic data from AutoID Devices.
     */
    diagnostics?: UAAutoIdDevice_diagnostics;
    getDeviceLocation?: UAMethod;
    ioData?: UAFunctionalGroup;
    /**
     * lastScanData
     * The last scanned AutoID Identifier.
     */
    lastScanData?: UABaseDataVariable<any, any>;
    /**
     * lastScanTimestamp
     * Point of time the last AutoID Identifier was
     * scanned.
     */
    lastScanTimestamp?: UABaseDataVariable<Date, DataType.DateTime>;
    runtimeParameters?: UAAutoIdDevice_runtimeParameters;
    scan?: UAMethod;
    /**
     * scanActive
     * Triggers the scan process.
     */
    scanActive?: UABaseDataVariable<boolean, DataType.Boolean>;
    scanStart?: UAMethod;
    scanStop?: UAMethod;
}
export interface UAAutoIdDevice extends UADevice, UAAutoIdDevice_Base {
}