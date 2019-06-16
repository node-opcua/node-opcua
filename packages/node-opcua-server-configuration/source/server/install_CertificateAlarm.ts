/**
 * @module node-opcua-server-configuration-server
 */
import chalk from "chalk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import {
    checkDebugFlag,
    make_debugLog,
    make_errorLog
} from "node-opcua-debug";
import {
    NodeId
} from "node-opcua-nodeid";
import {
    AddObjectOptions,
    AddressSpace,
    UACertificateExpirationAlarm
} from "node-opcua-address-space";
const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

export function installCertificateExpirationAlarm(addressSpace: AddressSpace) {

    debugLog("installCertificateExpirationAlarm");

    const server = addressSpace.rootFolder.objects.server;

    const namespace = addressSpace.getOwnNamespace();

    const certificateExpirationAlarmType = addressSpace.findEventType("CertificateExpirationAlarmType");

    const options = {
        browseName: "ServerCertificateAlarm",
        conditionSource: null,
        eventSourceOf: server,
        inputNode: NodeId.nullNodeId,
        normalState: NodeId.nullNodeId,
    };
    const data = {};
    const alarm = UACertificateExpirationAlarm.instantiate(namespace, options, data);
    // const alarm = namespace.instantiateOffNormalAlarm({) as UACertificateExpirationAlarm;
    alarm.currentBranch().setRetain(true);
    alarm.activeState.setValue(true);
}