import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Byte, UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTServerStatus } from "./dt_server_status";
import type { DTTimeZone } from "./dt_time_zone";
import type { UANamespaces } from "./ua_namespaces";
import type { UAServerCapabilities } from "./ua_server_capabilities";
import type { UAServerDiagnostics } from "./ua_server_diagnostics";
import type { UAServerRedundancy } from "./ua_server_redundancy";
import type { UAServerStatus } from "./ua_server_status";
import type { UAVendorServerInfo } from "./ua_vendor_server_info";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerType i=2004                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAServer_Base {
    serverArray: UAProperty<UAString[], DataType.String>;
    namespaceArray: UAProperty<UAString[], DataType.String>;
    urisVersion?: UAProperty<UInt32, DataType.UInt32>;
    serverStatus: UAServerStatus<DTServerStatus>;
    serviceLevel: UAProperty<Byte, DataType.Byte>;
    auditing: UAProperty<boolean, DataType.Boolean>;
    estimatedReturnTime?: UAProperty<Date, DataType.DateTime>;
    localTime?: UAProperty<DTTimeZone, DataType.ExtensionObject>;
    serverCapabilities: UAServerCapabilities;
    serverDiagnostics: UAServerDiagnostics;
    vendorServerInfo: UAVendorServerInfo;
    serverRedundancy: UAServerRedundancy;
    namespaces?: UANamespaces;
    getMonitoredItems?: UAMethod;
    resendData?: UAMethod;
    setSubscriptionDurable?: UAMethod;
    requestServerStateChange?: UAMethod;
}
export interface UAServer extends UAObject, UAServer_Base {}