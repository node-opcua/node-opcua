/**
 * @module node-opcua-server-configuration-server
 */
import {
    AddressSpace,
    UACertificateExpirationAlarm,
    UACertificateExpirationAlarmEx,
    UACertificateExpirationAlarmImpl
} from "node-opcua-address-space";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

export function installCertificateExpirationAlarm(addressSpace: AddressSpace): UACertificateExpirationAlarmEx {
    debugLog("installCertificateExpirationAlarm");

    const server = addressSpace.rootFolder.objects.server;

    const namespace = addressSpace.getOwnNamespace();

    const certificateExpirationAlarmType = addressSpace.findEventType("CertificateExpirationAlarmType");

    const options = {
        browseName: "ServerCertificateAlarm",
        conditionSource: undefined,
        eventSourceOf: server,
        inputNode: new NodeId(),
        normalState: new NodeId()
    };
    const data = {};
    const certificateExpirationAlarm = UACertificateExpirationAlarmImpl.instantiate(
        namespace,
        "CertificateExpirationAlarmType",
        options,
        data
    );
    // const alarm = namespace.instantiateOffNormalAlarm({) as UACertificateExpirationAlarm;
    certificateExpirationAlarm.currentBranch().setRetain(true);
    certificateExpirationAlarm.activeState.setValue(false);
    certificateExpirationAlarm.ackedState.setValue(false);
    certificateExpirationAlarm.suppressedState?.setValue(false);
    certificateExpirationAlarm.certificate.setValueFromSource({ dataType: DataType.ByteString, value: null });
    certificateExpirationAlarm.eventId.setValueFromSource({ dataType: DataType.ByteString, value: null });

    return certificateExpirationAlarm;
}
