/**
 * @module node-opcua-server-configuration-server
 */
import { AddressSpace, BaseNode, UACertificateExpirationAlarmEx, UACertificateExpirationAlarmImpl, UAObject } from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
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

    const options = {
        browseName: "ServerCertificateAlarm",
        conditionSource: undefined,
        eventSourceOf: server,
        inputNode: new NodeId(),
        normalState: new NodeId()
    };
    const certificateExpirationAlarm = UACertificateExpirationAlarmImpl.instantiate(
        namespace,
        "CertificateExpirationAlarmType",
        options
    );
    certificateExpirationAlarm.currentBranch().setRetain(true);
    certificateExpirationAlarm.activeState.setValue(false);
    certificateExpirationAlarm.ackedState.setValue(false);
    certificateExpirationAlarm.suppressedState?.setValue(false);
    certificateExpirationAlarm.certificate.setValueFromSource({ dataType: DataType.ByteString, value: null });
    certificateExpirationAlarm.eventId.setValueFromSource({ dataType: DataType.ByteString, value: null });

    return certificateExpirationAlarm;
}

export function promoteCertificateExpirationAlarm(certificateExpirationAlarm: UAObject): UACertificateExpirationAlarmEx {

    const addressSpace =certificateExpirationAlarm.addressSpace;
    const certificateExpirationAlarmType = addressSpace.findEventType("CertificateExpirationAlarmType");
    if (!certificateExpirationAlarmType) {
        throw new Error("Cannot find CertificateExpirationAlarmType");
    }
    if (!sameNodeId(certificateExpirationAlarm.typeDefinition,certificateExpirationAlarmType.nodeId)) {
        throw new Error("CertificateExpirationAlarmType is not the type of the certificateExpirationAlarm");
    }
    Object.setPrototypeOf(certificateExpirationAlarm, UACertificateExpirationAlarmImpl.prototype);
    return certificateExpirationAlarm as UACertificateExpirationAlarmImpl;
}