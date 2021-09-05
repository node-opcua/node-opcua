import { UADynamicVariableArray, UAMethod, UAObject, UAVariable, UAVariableT } from "node-opcua-address-space-base";
import { DateTime, UAString, UInt32 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import { UAFolder, UAServer, UAServerCapabilities, UAServerConfiguration } from "node-opcua-nodeset-ua";
import {
    BuildInfo,
    ServerDiagnosticsSummaryDataType,
    ServerState,
    ServerStatusDataType,
    SessionDiagnosticsDataType,
    SessionSecurityDiagnosticsDataType
} from "node-opcua-types";
import { DataType } from "node-opcua-variant";

/*
export interface BuildInfo1 extends UAVariable {
    productUri: UAVariableT<UAString, DataType.String>;
    manufacturerName: UAVariableT<UAString, DataType.String>;
    productName: UAVariableT<UAString, DataType.String>;
    softwareVersion: UAVariableT<UAString, DataType.String>;
    buildNumber: UAVariableT<UAString, DataType.String>;
    buildDate: UAVariableT<DateTime, DataType.DateTime>;
    $extensionObject: BuildInfo;
}

export interface UAServerStatus extends UAVariable {
    startTime: UAVariableT<DateTime, DataType.DateTime>;
    currentTime: UAVariableT<DateTime, DataType.DateTime>;
    state: UAVariableT<ServerState, DataType.ExtensionObject>; // Enumeration
    secondsTillShutdown: UAVariableT<UInt32, DataType.UInt32>;
    shutdownReason: UAVariableT<LocalizedText, DataType.LocalizedText>;
    buildInfo: BuildInfo1;

    $extensionObject: ServerStatusDataType;
}

export interface UASessionDiagnostics extends UAVariable {
    $extensionObject: SessionDiagnosticsDataType;
}
export interface UASessionSecurityDiagnostics extends UAVariable {
    $extensionObject: SessionSecurityDiagnosticsDataType;
}

export interface UAServerDiagnosticsSummary extends UAVariable {
    $extensionObject: ServerDiagnosticsSummaryDataType;
}

export interface UASessionDiagnosticsSummary extends UAObject {
    sessionDiagnosticsArray: UADynamicVariableArray<SessionDiagnosticsDataType>;
    sessionSecurityDiagnosticsArray: UADynamicVariableArray<SessionSecurityDiagnosticsDataType>;
}

export interface UAServerDiagnostics extends UAObject {
    sessionsDiagnosticsSummary: UASessionDiagnosticsSummary;
    enabledFlag: UAVariableT<boolean, DataType.Boolean>;
    bindExtensionObject(obj: UAServerDiagnosticsSummary): UAServerDiagnosticsSummary;
}
*/

export interface UAObjectsFolder extends UAFolder {
    server: UAServer;
}

export interface UARootFolder extends UAFolder {
    objects: UAObjectsFolder;
    types: UAFolder;
    views: UAFolder;
}
