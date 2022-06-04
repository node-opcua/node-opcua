// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTSignedSoftwareCertificate } from "./dt_signed_software_certificate"
import { UAOperationLimits } from "./ua_operation_limits"
import { UAFolder } from "./ua_folder"
import { UARoleSet } from "./ua_role_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerCapabilitiesType ns=0;i=2013                |
 * |isAbstract      |false                                             |
 */
export interface UAServerCapabilities_Base {
    serverProfileArray: UAProperty<UAString[], /*z*/DataType.String>;
    localeIdArray: UAProperty<UAString[], /*z*/DataType.String>;
    minSupportedSampleRate: UAProperty<number, /*z*/DataType.Double>;
    maxBrowseContinuationPoints: UAProperty<UInt16, /*z*/DataType.UInt16>;
    maxQueryContinuationPoints: UAProperty<UInt16, /*z*/DataType.UInt16>;
    maxHistoryContinuationPoints: UAProperty<UInt16, /*z*/DataType.UInt16>;
    softwareCertificates: UAProperty<DTSignedSoftwareCertificate[], /*z*/DataType.ExtensionObject>;
    maxArrayLength?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxStringLength?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxByteStringLength?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    operationLimits?: UAOperationLimits;
    modellingRules: UAFolder;
    aggregateFunctions: UAFolder;
    roleSet?: UARoleSet;
    maxSessions?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxSubscriptions?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxMonitoredItems?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxSubscriptionsPerSession?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxMonitoredItemsPerSubscription?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxSelectClauseParameters?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxWhereClauseParameters?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    conformanceUnits?: UAProperty<QualifiedName[], /*z*/DataType.QualifiedName>;
}
export interface UAServerCapabilities extends UAObject, UAServerCapabilities_Base {
}