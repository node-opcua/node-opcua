import fs from "fs";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";

import { extractFields, simpleBrowsePathsToString}  from "node-opcua-pseudo-session";

import { generateAddressSpace } from "../nodeJS";
import { AddressSpace, PseudoSession } from "..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("extractFields", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        const xmlFiles = [nodesets.standard, nodesets.di, nodesets.autoId];
        addressSpace = AddressSpace.create();
        fs.existsSync(xmlFiles[0]).should.eql(true);
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("urn:OwnNamespace");
    });
    after(() => {
        addressSpace.dispose();
    });

    describe("testing extractFields", () => {
        it("on AutoIdScanEventType", async () => {
            //
            const nsAuditId = addressSpace.getNamespace("http://opcfoundation.org/UA/AutoID/");
            should.exist(nsAuditId, "expecting to find AutoID namespace");
            const AutoIdScanEventType = nsAuditId.findObjectType("AutoIdScanEventType");
            if (!AutoIdScanEventType) throw new Error("");
            const session = new PseudoSession(addressSpace);
            const e = await extractFields(session, AutoIdScanEventType.nodeId);

            const b = simpleBrowsePathsToString(e.map((a) => a.path));
            b.sort().should.eql([
                "2:DeviceName",
                "2:ScanResult",
                "ConditionClassId",
                "ConditionClassName",
                "ConditionSubClassId",
                "ConditionSubClassName",
                "EventId",
                "EventType",
                "LocalTime",
                "Message",
                "ReceiveTime",
                "Severity",
                "SourceName",
                "SourceNode",
                "Time"
            ]);
        });
        it("on TransitionEventType", async () => {
            const session = new PseudoSession(addressSpace);
            const e = await extractFields(session, resolveNodeId("TransitionEventType"));
            const b = simpleBrowsePathsToString(e.map((a) => a.path));
            b.sort().should.eql([
                "ConditionClassId",
                "ConditionClassName",
                "ConditionSubClassId",
                "ConditionSubClassName",
                "EventId",
                "EventType",
                "FromState",
                "FromState.Id",
                "LocalTime",
                "Message",
                "ReceiveTime",
                "Severity",
                "SourceName",
                "SourceNode",
                "Time",
                "ToState",
                "ToState.Id",
                "Transition",
                "Transition.Id"
            ]);
        });
    });
});
