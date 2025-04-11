// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { DTServerStatus } from "./dt_server_status"
import { DTTimeZone } from "./dt_time_zone"
import { UAServerStatus } from "./ua_server_status"
import { UAServerCapabilities } from "./ua_server_capabilities"
import { UAServerDiagnostics } from "./ua_server_diagnostics"
import { UAVendorServerInfo } from "./ua_vendor_server_info"
import { UAServerRedundancy } from "./ua_server_redundancy"
import { UANamespaces } from "./ua_namespaces"
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
export interface UAServer extends UAObject, UAServer_Base {
}