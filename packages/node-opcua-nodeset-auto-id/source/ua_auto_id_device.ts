// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, Int32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/source/ua_device"
import { DTLocation } from "./dt_location"
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
      presence?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
export interface UAAutoIdDevice_runtimeParameters extends UAFunctionalGroup { // Object
      /**
       * codeTypes
       * Supported CodeTypes and selected CodeType for the
       * ScanData.
       */
      codeTypes?: UAMultiStateDiscrete<UInt32[], /*z*/DataType.UInt32>;
      /**
       * scanSettings
       * Scan settings used together with ScanActive
       * Variable.
       */
      scanSettings?: UAFunctionalGroup;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdDeviceType ns=3;i=1001                    |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdDevice_Base extends UADevice_Base {
    autoIdModelVersion: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * deviceInfo
     * Device status information.
     */
    deviceInfo?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * deviceLocation
     * Union of GPS, UTM, Local.
     */
    deviceLocation?: UALocationVariable<DTLocation>;
    /**
     * deviceLocationName
     * Symbolic name of the device location.
     */
    deviceLocationName?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * deviceName
     * Default could be also host name, IP address or
     * MAC. This should be a field that can be
     * configured for a device.
     */
    deviceName: UAProperty<UAString, /*z*/DataType.String>;
    deviceStatus: UABaseDataVariable<any, any>;
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
    lastScanTimestamp?: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    runtimeParameters?: UAAutoIdDevice_runtimeParameters;
    scan?: UAMethod;
    /**
     * scanActive
     * Triggers the scan process.
     */
    scanActive?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    scanStart?: UAMethod;
    scanStop?: UAMethod;
}
export interface UAAutoIdDevice extends UADevice, UAAutoIdDevice_Base {
}