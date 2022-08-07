/**
 * @module node-opcua-server-configuration-server
 */
import {
    AddressSpace,
    BaseNode,
    instantiateCertificateExpirationAlarm,
    UACertificateExpirationAlarmEx,
    UAObject
} from "node-opcua-address-space";
import { InstantiateOffNormalAlarmOptions } from "node-opcua-address-space";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

/**
 *
 * @param addressSpace
 * @returns
 * @deprecated
 */
export function installCertificateExpirationAlarm(addressSpace: AddressSpace): UACertificateExpirationAlarmEx {
    debugLog("installCertificateExpirationAlarm");
    /**
     * note: the ServerCertificateAlarm is not in the OPCUA standard
     */
    const server = addressSpace.rootFolder.objects.server;
    const namespace = addressSpace.getOwnNamespace();

    const options: InstantiateOffNormalAlarmOptions = {
        browseName: "ServerCertificateAlarm",
        conditionSource: undefined,
        eventSourceOf: server,
        inputNode: new NodeId(),
        normalState: new NodeId(),
        optionals: ["ExpirationLimit"]
    };
    const certificateExpirationAlarm = instantiateCertificateExpirationAlarm(
        namespace,
        "CertificateExpirationAlarmType",
        options
    );
    certificateExpirationAlarm.currentBranch().setRetain(false);
    certificateExpirationAlarm.activeState.setValue(false);
    certificateExpirationAlarm.ackedState.setValue(false);
    certificateExpirationAlarm.suppressedState?.setValue(false);
    certificateExpirationAlarm.certificate.setValueFromSource({ dataType: DataType.ByteString, value: null });
    certificateExpirationAlarm.eventId.setValueFromSource({ dataType: DataType.ByteString, value: null });

    return certificateExpirationAlarm;
}
