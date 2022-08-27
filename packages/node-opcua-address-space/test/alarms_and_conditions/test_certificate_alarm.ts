/* eslint-disable max-statements */
import * as path from "path";
import * as sinon from "sinon";
import "should";
import { nodesets } from "node-opcua-nodesets";
import { NodeId } from "node-opcua-nodeid";
import { readCertificate } from "node-opcua-crypto";

import { AddressSpace, instantiateCertificateExpirationAlarm, UACertificateExpirationAlarmEx } from "../..";
import { generateAddressSpace } from "../../distNodeJS";

export const OneDayDuration = 1000 * 60 * 60 * 24;
export const TwoWeeksDuration = OneDayDuration * 2 * 7;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Test Certificate alarm", function () {
    let clock: sinon.SinonFakeTimers | undefined;
    beforeEach(() => {
        clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true, shouldClearNativeTimers: true } as any);
    });
    afterEach(() => {
        clock!.restore();
        clock = undefined;
    });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    let addressSpace: AddressSpace;
    this.timeout(Math.max(this.timeout(), 100000));

    const demo = path.join(__dirname, "../../../node-opcua-samples/certificates");
    const not_active_yet = readCertificate(path.join(demo, "client_cert_1024_not_active_yet.pem"));
    const out_of_date = readCertificate(path.join(demo, "client_cert_1024_outofdate.pem"));
    const revoked = readCertificate(path.join(demo, "client_cert_1024_revoked.pem"));
    const ok = readCertificate(path.join(demo, "client_cert_1024.pem"));

    before(async () => {
        addressSpace = AddressSpace.create();
        const ownNamespace = addressSpace.registerNamespace("PRIVATE_NAMESPACE");
        ownNamespace.index.should.eql(1);
        const xml_file = nodesets.standard;
        await generateAddressSpace(addressSpace, xml_file);
        const namespace = addressSpace.getOwnNamespace();
        addressSpace.installAlarmsAndConditionsService();
    });

    after(() => {
        addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("should activate certificate Expiry alarm appropriately", () => {
        const namespace = addressSpace.getOwnNamespace();
        const certificate1: UACertificateExpirationAlarmEx = instantiateCertificateExpirationAlarm(
            namespace,
            "CertificateExpirationAlarmType",
            {
                browseName: "CertificateExpiry",
                conditionName: "Expiry",
                inputNode: NodeId.nullNodeId,
                normalState: NodeId.nullNodeId,
                conditionSource: null,
                organizedBy: addressSpace.rootFolder.objects,
                conditionOf: addressSpace.rootFolder.objects
            }
        );

        const raiseEventSpy = sinon.spy();
        addressSpace.rootFolder.objects.server.on("event", raiseEventSpy);

        raiseEventSpy.resetHistory();
        certificate1.setCertificate(ok);
        certificate1.activeState.getValue().should.eql(false);
        raiseEventSpy.getCall(0).args[0].message.value.text.should.match(/is OK/);
        raiseEventSpy.getCall(0).args[0].severity.value.should.be.eql(0);
        

        raiseEventSpy.resetHistory();
        certificate1.setCertificate(out_of_date);
        certificate1.activeState.getValue().should.eql(true);
        raiseEventSpy.callCount.should.eql(1);
        raiseEventSpy.getCall(0).args[0].message.value.text.should.match(/has expired/);
        raiseEventSpy.getCall(0).args[0].severity.value.should.be.greaterThan(100);
        certificate1.currentBranch().getRetain().should.eql(true);
        
        raiseEventSpy.resetHistory();
        certificate1.setCertificate(ok);
        certificate1.activeState.getValue().should.eql(false);
        raiseEventSpy.getCall(0).args[0].message.value.text.should.match(/is OK/);
        raiseEventSpy.getCall(0).args[0].severity.value.should.be.eql(0);

        const expiryDate = certificate1.getExpirationDate()!;
        expiryDate.getTime().should.be.greaterThan(Date.now());

        const timeBeforeExpiration = expiryDate!.getTime() - Date.now();

        // console.log("timeBeforeExpiration = ", timeBeforeExpiration / 1000, timeBeforeExpiration / (1000 * 60));

        certificate1.setExpirationLimit(TwoWeeksDuration); 
        
        clock?.setSystemTime(expiryDate.getTime() - 2 * TwoWeeksDuration);
        certificate1.update();
        certificate1.activeState.getValue().should.eql(false);
        
        
        clock?.setSystemTime(expiryDate.getTime() - TwoWeeksDuration + 1);
        certificate1.update();
        certificate1.activeState.getValue().should.eql(true);
        certificate1.currentBranch().getRetain().should.eql(true);
        certificate1.currentBranch().getSeverity().should.eql(100);
     
        clock?.setSystemTime(expiryDate.getTime() -  TwoWeeksDuration/2.0);
        certificate1.update();
        certificate1.activeState.getValue().should.eql(true);
        certificate1.currentBranch().getRetain().should.eql(true);
        certificate1.currentBranch().getSeverity().should.eql(150);
 
        clock?.setSystemTime(expiryDate.getTime() - 1);
        certificate1.update();
        certificate1.activeState.getValue().should.eql(true);
        certificate1.currentBranch().getRetain().should.eql(true);
        certificate1.currentBranch().getSeverity().should.eql(199);
 

    });

    it("should update the alarm on a regular basis", () => {
        const namespace = addressSpace.getOwnNamespace();
        const certificate1: UACertificateExpirationAlarmEx = instantiateCertificateExpirationAlarm(
            namespace,
            "CertificateExpirationAlarmType",
            {
                browseName: "CertificateExpiry",
                conditionName: "Expiry",
                inputNode: NodeId.nullNodeId,
                normalState: NodeId.nullNodeId,
                conditionSource: null,
                organizedBy: addressSpace.rootFolder.objects,
                conditionOf: addressSpace.rootFolder.objects
            }
        );

        const raiseEventSpy = sinon.spy();
        addressSpace.rootFolder.objects.server.on("event", raiseEventSpy);

        raiseEventSpy.resetHistory();
        certificate1.setCertificate(ok);
        certificate1.activeState.getValue().should.eql(false);
        raiseEventSpy.getCall(0).args[0].message.value.text.should.match(/is OK/);
        raiseEventSpy.getCall(0).args[0].severity.value.should.be.eql(0);

        const expiryDate = certificate1.getExpirationDate()!;
        expiryDate.getTime().should.be.greaterThan(Date.now());

        const timeBeforeExpiration = expiryDate!.getTime() - Date.now();

        // console.log("timeBeforeExpiration = ", timeBeforeExpiration / 1000, timeBeforeExpiration / (1000 * 60));

        certificate1.setExpirationLimit(TwoWeeksDuration); 
        
        clock?.setSystemTime(expiryDate.getTime() - TwoWeeksDuration -1);
        certificate1.update();
        certificate1.activeState.getValue().should.eql(false);
        
        // now advance timer , it should at least update alarm twice a day
        raiseEventSpy.resetHistory();
        
        clock?.tick(OneDayDuration);
        raiseEventSpy.callCount.should.be.greaterThan(2);
        const severity1 =     certificate1.currentBranch().getSeverity();
        severity1.should.be.greaterThan(100);

        clock?.tick(OneDayDuration);
        raiseEventSpy.callCount.should.be.greaterThan(4);
        const severity2 =     certificate1.currentBranch().getSeverity();
        severity2.should.be.greaterThan(severity1+3);
    });


});
