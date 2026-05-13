import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { DTSignedSoftwareCertificate } from "./dt_signed_software_certificate";
import type { UAFolder } from "./ua_folder";
import type { UAOperationLimits } from "./ua_operation_limits";
import type { UARoleSet } from "./ua_role_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerCapabilitiesType i=2013                               |
 * |isAbstract      |false                                                       |
 */
export interface UAServerCapabilities_Base {
    serverProfileArray: UAProperty<UAString[], DataType.String>;
    localeIdArray: UAProperty<UAString[], DataType.String>;
    minSupportedSampleRate: UAProperty<number, DataType.Double>;
    maxBrowseContinuationPoints: UAProperty<UInt16, DataType.UInt16>;
    maxQueryContinuationPoints: UAProperty<UInt16, DataType.UInt16>;
    maxHistoryContinuationPoints: UAProperty<UInt16, DataType.UInt16>;
    maxLogObjectContinuationPoints?: UAProperty<UInt16, DataType.UInt16>;
    softwareCertificates: UAProperty<DTSignedSoftwareCertificate[], DataType.ExtensionObject>;
    maxArrayLength?: UAProperty<UInt32, DataType.UInt32>;
    maxStringLength?: UAProperty<UInt32, DataType.UInt32>;
    maxByteStringLength?: UAProperty<UInt32, DataType.UInt32>;
    operationLimits?: UAOperationLimits;
    modellingRules: UAFolder;
    aggregateFunctions: UAFolder;
   // PlaceHolder for $VendorCapability$
    roleSet?: UARoleSet;
    maxSessions?: UAProperty<UInt32, DataType.UInt32>;
    maxSubscriptions?: UAProperty<UInt32, DataType.UInt32>;
    maxMonitoredItems?: UAProperty<UInt32, DataType.UInt32>;
    maxSubscriptionsPerSession?: UAProperty<UInt32, DataType.UInt32>;
    maxMonitoredItemsPerSubscription?: UAProperty<UInt32, DataType.UInt32>;
    maxSelectClauseParameters?: UAProperty<UInt32, DataType.UInt32>;
    maxWhereClauseParameters?: UAProperty<UInt32, DataType.UInt32>;
    maxMonitoredItemsQueueSize?: UAProperty<UInt32, DataType.UInt32>;
    conformanceUnits?: UAProperty<QualifiedName[], DataType.QualifiedName>;
}
export interface UAServerCapabilities extends UAObject, UAServerCapabilities_Base {}