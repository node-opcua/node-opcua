import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { RequestHeader } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";

import { type AddressSpace, PseudoSession, SessionContext, type UAMethod, type UAObject } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../testHelpers.js";

// OPC 10000-4 v1.05.07 §7.32 RequestHeader.auditEntryId / OPC 10000-5 v1.05.06 §6.4.3
// AuditEventType.ClientAuditEntryId: a Method handler that raises an audit event needs the
// RequestHeader of the Call that invoked it. These tests cover SessionContext's carrier for
// that value on its own, before the end-to-end tests exercise it through a real Call.
describe("SessionContext#withRequestHeader / #getAuditEntryId", () => {
    it("carries no RequestHeader by default", () => {
        should(SessionContext.defaultContext.requestHeader).eql(undefined);
        should(SessionContext.defaultContext.getAuditEntryId()).eql(undefined);
    });

    it("withRequestHeader returns a *new* SessionContext; the original is left untouched", () => {
        const base = new SessionContext({});
        const derived = base.withRequestHeader(new RequestHeader({ auditEntryId: "entry-1" }));

        should(derived).not.equal(base);
        should(base.requestHeader).eql(undefined);
        should(base.getAuditEntryId()).eql(undefined);
        should(derived.requestHeader?.auditEntryId).eql("entry-1");
        should(derived.getAuditEntryId()).eql("entry-1");
    });

    it("getAuditEntryId() reads back a null or empty auditEntryId as undefined", () => {
        should(new SessionContext({}).withRequestHeader(new RequestHeader({ auditEntryId: null })).getAuditEntryId()).eql(
            undefined
        );
        should(new SessionContext({}).withRequestHeader(new RequestHeader({ auditEntryId: "" })).getAuditEntryId()).eql(undefined);
    });

    // the design this proves: two contexts derived from the same base own their RequestHeader
    // independently, so building one per Call (instead of writing onto the Session's shared
    // sessionContext) cannot let one Call's id leak into another's.
    it("two contexts derived from the same base never see each other's RequestHeader", () => {
        const base = new SessionContext({});
        const first = base.withRequestHeader(new RequestHeader({ auditEntryId: "call-1" }));
        const second = base.withRequestHeader(new RequestHeader({ auditEntryId: "call-2" }));

        should(first.getAuditEntryId()).eql("call-1");
        should(second.getAuditEntryId()).eql("call-2");
        should(base.getAuditEntryId()).eql(undefined);
    });
});

describe("PseudoSession.call exposes the context's RequestHeader to a bound Method handler", () => {
    let addressSpace: AddressSpace;
    let object: UAObject;
    let method: UAMethod;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        const namespace = addressSpace.getOwnNamespace();
        object = namespace.addObject({ browseName: "EchoAuditEntryIdObject", nodeId: "s=EchoAuditEntryIdObject" });
        method = namespace.addMethod(object, {
            browseName: "EchoAuditEntryId",
            nodeId: "s=EchoAuditEntryId",
            outputArguments: [{ name: "auditEntryId", dataType: DataType.String }]
        });
        method.bindMethod(async (_inputArguments, context) => {
            return {
                outputArguments: [{ dataType: DataType.String, value: context.getAuditEntryId() ?? "" }]
            };
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("reports an empty auditEntryId when the PseudoSession's context carries no RequestHeader", async () => {
        const session = new PseudoSession(addressSpace); // SessionContext.defaultContext: no RequestHeader
        const result = await session.call({ objectId: object.nodeId, methodId: method.nodeId, inputArguments: [] });
        should(result.statusCode.isGood()).eql(true);
        should(result.outputArguments?.[0]?.value).eql("");
    });

    it("reports the RequestHeader's auditEntryId when the PseudoSession was built with one", async () => {
        const context = SessionContext.defaultContext.withRequestHeader(new RequestHeader({ auditEntryId: "pseudo-call-1" }));
        const session = new PseudoSession(addressSpace, context);
        const result = await session.call({ objectId: object.nodeId, methodId: method.nodeId, inputArguments: [] });
        should(result.statusCode.isGood()).eql(true);
        should(result.outputArguments?.[0]?.value).eql("pseudo-call-1");
    });
});
