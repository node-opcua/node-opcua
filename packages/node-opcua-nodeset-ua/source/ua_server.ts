// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt64, UInt32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { DTServerStatus } from "./dt_server_status"
import { EnumServerState } from "./enum_server_state"
import { DTBuildInfo } from "./dt_build_info"
import { DTTimeZone } from "./dt_time_zone"
import { DTSignedSoftwareCertificate } from "./dt_signed_software_certificate"
import { DTIdentityMappingRule } from "./dt_identity_mapping_rule"
import { DTEndpoint } from "./dt_endpoint"
import { DTArgument } from "./dt_argument"
import { DTServerDiagnosticsSummary } from "./dt_server_diagnostics_summary"
import { DTSamplingIntervalDiagnostics } from "./dt_sampling_interval_diagnostics"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
import { DTSessionDiagnostics } from "./dt_session_diagnostics"
import { DTApplicationDescription } from "./dt_application_description"
import { DTServiceCounter } from "./dt_service_counter"
import { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { EnumRedundancySupport } from "./enum_redundancy_support"
import { EnumId } from "./enum_id"
import { DTRolePermission } from "./dt_role_permission"
import { UAServerStatus } from "./ua_server_status"
import { UAServerCapabilities } from "./ua_server_capabilities"
import { UAServerDiagnostics } from "./ua_server_diagnostics"
import { UAVendorServerInfo } from "./ua_vendor_server_info"
import { UAServerRedundancy } from "./ua_server_redundancy"
import { UANamespaces } from "./ua_namespaces"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerType ns=0;i=2004                            |
 * |isAbstract      |false                                             |
 */
export interface UAServer_Base {
    serverArray: UAProperty<UAString[], /*z*/DataType.String>;
    namespaceArray: UAProperty<UAString[], /*z*/DataType.String>;
    urisVersion?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    serverStatus: UAServerStatus<DTServerStatus>;
    serviceLevel: UAProperty<Byte, /*z*/DataType.Byte>;
    auditing: UAProperty<boolean, /*z*/DataType.Boolean>;
    estimatedReturnTime?: UAProperty<Date, /*z*/DataType.DateTime>;
    localTime?: UAProperty<DTTimeZone, /*z*/DataType.ExtensionObject>;
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