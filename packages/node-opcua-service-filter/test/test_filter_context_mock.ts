import * as should from "should";
import { resolveNodeId } from "node-opcua-nodeid";
import { NodeClass } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { FilterContextMock } from "./filter_context_mock";

describe("Test FilterContext Mock", function () {
    const filterContext = new FilterContextMock();

    it("should have a Number dataType", () => {
        filterContext.findNodeByName("Number").toString().should.eql("ns=0;i=26");
        filterContext.findNodeByName("RootFolder.Objects.Server").toString().should.eql("ns=0;i=2253");
        filterContext.findNodeByName(resolveNodeId("Server").toString()).toString().should.eql("ns=0;i=2253");

        const serverNodeId = filterContext.findNodeByName("RootFolder.Objects.Server");
        filterContext.getNodeClass(serverNodeId).should.eql(NodeClass.Object);

        const variableWithAlarm = filterContext.findNodeByName("RootFolder.Objects.Server.VariableWithAlarm")!;

        const hl = filterContext.browsePath(makeBrowsePath(variableWithAlarm, ".HighLimit"))!;
        should.exist(hl);

        const hltd = filterContext.getTypeDefinition(hl)!;
        filterContext.getNodeClass(hltd).should.eql(NodeClass.VariableType);

        const hlv = filterContext.readNodeValue(hl);
        hlv.dataType.should.eql(DataType.Double);
        hlv.value.should.eql(90);
        console.log(hlv.toString());
    });

    it("AuditCertificateExpiredEventType subtype of ", () => {
        const AuditCertificateExpiredEventType = resolveNodeId("AuditCertificateExpiredEventType");
        const AuditEventType = resolveNodeId("AuditEventType");

        filterContext.isSubtypeOf(AuditCertificateExpiredEventType, AuditEventType).should.eql(true);
        filterContext.isSubtypeOf(AuditEventType, AuditCertificateExpiredEventType).should.eql(false);
    });
    it("unrelated Events", () => {
        const EventQueueOverflowEventType = resolveNodeId("EventQueueOverflowEventType");
        const SystemEventType = resolveNodeId("SystemEventType");

        filterContext.isSubtypeOf(EventQueueOverflowEventType, SystemEventType).should.eql(false);
        filterContext.isSubtypeOf(SystemEventType, EventQueueOverflowEventType).should.eql(false);
    });
    //  /
});
