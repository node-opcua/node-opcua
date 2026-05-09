// tslint:disable:no-console

import { Benchmarker } from "node-opcua-benchmarker";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { checkSelectClause, constructEventFilter } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import type { AddressSpace, Namespace } from "..";
import { getMiniAddressSpace } from "../testHelpers";

describe("AddressSpace : add event type ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();

        const _eventType = namespace.addEventType({
            browseName: "MyCustomEvent",
            // isAbstract:false,
            subtypeOf: "BaseEventType" // should be implicit
        });
    });

    after(() => {
        addressSpace.dispose();
    });

    it("#generateEventId should generate event id sequentially", () => {
        const id1 = addressSpace.generateEventId();
        const id2 = addressSpace.generateEventId();
        const id3 = addressSpace.generateEventId();
        // xx console.log(id1.value.toString("hex"));
        // xx console.log(id2.value.toString("hex"));
        // xx console.log(id3.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id2.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id3.value.toString("hex"));
    });

    it("should find BaseEventType", () => {
        addressSpace.findEventType("BaseEventType")?.nodeId.toString().should.eql("ns=0;i=2041");
    });

    it("BaseEventType should be abstract ", () => {
        const baseEventType = addressSpace.findEventType("BaseEventType");
        if (!baseEventType) throw new Error("cannot find BaseEventType");
        baseEventType.nodeId.toString().should.eql("ns=0;i=2041");
        baseEventType.isAbstract.should.eql(true);
    });

    it("should find AuditEventType", () => {
        const auditEventType = addressSpace.findEventType("AuditEventType");
        if (!auditEventType) throw new Error("cannot find AuditEventType");
        auditEventType.nodeId.toString().should.eql("ns=0;i=2052");
        auditEventType.isAbstract.should.eql(true);
    });

    it("should verify that AuditEventType is a superType of BaseEventType", () => {
        const baseEventType = addressSpace.findObjectType("BaseEventType");
        if (!baseEventType) throw new Error("cannot find BaseEventType");
        const auditEventType = addressSpace.findObjectType("AuditEventType");
        if (!auditEventType) throw new Error("cannot find AuditEventType");
        auditEventType.isSubtypeOf(baseEventType).should.eql(true);
        baseEventType.isSubtypeOf(auditEventType).should.eql(false);
    });

    it("should find a newly added EventType", () => {
        should(addressSpace.findEventType("__EventTypeForTest1")).eql(null);

        const eventType = namespace.addEventType({
            browseName: "__EventTypeForTest1",
            subtypeOf: "BaseEventType" // should be implicit
        });
        eventType.browseName.toString().should.eql("1:__EventTypeForTest1");

        const privateNamespace = addressSpace.getOwnNamespace();

        const reloaded = addressSpace.findEventType("__EventTypeForTest1", privateNamespace.index);

        should(reloaded).not.eql(null, "cannot findEventType " + "__EventTypeForTest1");
        should(reloaded?.nodeId).eql(eventType.nodeId);
    });

    it("should retrieve EventType in several ways", () => {
        const namespaceIndex = addressSpace.getOwnNamespace().index;
        namespaceIndex.should.eql(1);

        const eventType1 = addressSpace.findEventType("MyCustomEvent", namespaceIndex);

        const eventType2 = addressSpace.getOwnNamespace().findObjectType("MyCustomEvent");
        const eventType3 = addressSpace.findEventType("1:MyCustomEvent");

        should(eventType1).eql(eventType2);
        should(eventType1).eql(eventType3);
    });

    it("added EventType should be abstract by default", () => {
        const namespaceIndex = addressSpace.getOwnNamespace().index;
        const eventType = addressSpace.findEventType("MyCustomEvent", namespaceIndex);
        if (!eventType) throw new Error("cannot find MyCustomEvent");
        eventType.isAbstract.should.eql(true);

        eventType.browseName.toString().should.eql("1:MyCustomEvent");
    });

    it("should be possible to add a non-abstract event type", () => {
        const eventType = namespace.addEventType({
            browseName: "MyConcreteCustomEvent",
            isAbstract: false
        });
        eventType.browseName.toString().should.eql("1:MyConcreteCustomEvent");
        eventType.isAbstract.should.eql(false);
    });

    it("should select node in a EventType using a SelectClause on BaseEventType", () => {
        // browseNodeByTargetName
        const baseEventType = addressSpace.findEventType("BaseEventType");
        if (!baseEventType) throw new Error("cannot find BaseEventType");

        const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        if (!eventFilter.selectClauses) {
            throw new Error("expecting selectClauses to be defined");
        }
        should(eventFilter.selectClauses?.length).eql(3, "expecting 3 select clauses");

        let statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);
    });

    it("should select node in a EventType using a SelectClause  n AuditEventType", () => {
        // browseNodeByTargetName
        const auditEventType = addressSpace.findEventType("AuditEventType");
        if (!auditEventType) throw new Error("cannot find AuditEventType");

        const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        if (!eventFilter.selectClauses) {
            throw new Error("expecting selectClauses to be defined");
        }
        should(eventFilter.selectClauses?.length).eql(3, "expecting 3 select clauses");

        let statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);
    });

    it("should instantiate a condition efficiently ( more than 1000 per second on a decent computer)", async () => {
        const bench = new Benchmarker();

        const eventType = namespace.addEventType({
            browseName: "MyConditionType",
            isAbstract: false,
            subtypeOf: "ConditionType"
        });

        let counter = 0;
        await bench
            .add("test", () => {
                try {
                    const condition = namespace.instantiateCondition(eventType, {
                        browseName: `MyCondition${counter}`,
                        conditionSource: undefined,
                        receiveTime: { dataType: "DateTime", value: new Date(1789, 6, 14) },
                        sourceName: { dataType: "String", value: "HelloWorld" }
                    });
                    condition.browseName.toString().should.eql(`1:MyCondition${counter}`);
                } catch (err) {
                    console.log((err as Error).message);
                } finally {
                    counter += 1;
                }
            })
            .run({ max_time: 0.1 });

        console.log("    Fastest is :  ", bench.fastest?.name);
        console.log("      count    :  ", bench.fastest?.result?.count);
    });

    it("#constructEventData ", () => {
        const auditEventType = addressSpace.findObjectType("AuditEventType");
        if (!auditEventType) throw new Error("cannot find AuditEventType");
        const data = {
            actionTimeStamp: { dataType: "Null" },
            clientAuditEntryId: { dataType: "Null" },
            clientUserId: { dataType: "Null" },
            serverId: { dataType: "Null" },
            sourceNode: { dataType: "NodeId", value: resolveNodeId("Server") },
            status: { dataType: "Null" }
        };

        const data1 = addressSpace.constructEventData(auditEventType, data);

        const expected_fields = [
            "actionTimeStamp",
            "clientAuditEntryId",
            "clientUserId",
            "eventId",
            "eventType",
            "localTime",
            "message",
            "receiveTime",
            "serverId",
            "severity",
            "sourceName",
            "sourceNode",
            "status",
            "time"
        ];

        Object.keys(data1).sort().should.eql(expected_fields);
        // xx console.log(JSON.stringify(data,null," "));
    });

    // xit("#createEventData should add an basic event type", () => {
    //
    //     const eventType = addressSpace.findEventType("MyCustomEvent")!;
    //     eventType.browseName.toString().should.eql("MyCustomEvent");
    //
    //     namespace.addVariable({
    //         browseName: "MyCustomEventProperty",
    //         dataType: "Double",
    //         propertyOf: eventType,
    //         value: { dataType: DataType.Double, value: 1.0 }
    //     });
    //
    //     const event = addressSpace.createEventData("MyCustomEvent", {
    //         receiveTime: {
    //             dataType: "DateTime",
    //             value: new Date(1789, 6, 14)
    //         },
    //         sourceName: {
    //             dataType: "String",
    //             value: "HelloWorld"
    //         },
    //     });
    //
    //     // event shall have property of BaseEventType
    //     // see OPC Spec 1.02 : part 5 : page 19 :  6.4.2 BaseEventType
    //     //
    //     // EventId     ByteString
    //     // EventType   NodeId
    //     // SourceNode  NodeId
    //     // SourceName  String
    //     // Time        UtcTime
    //     // ReceiveTime UtcTime
    //     // LocalTime   TimeZoneDataType // optional
    //     // Message     LocalizedText
    //     // Severity    UInt16
    //
    //     event.should.have.property("eventId");
    //     event.should.have.property("eventType");
    //     event.should.have.property("sourceNode");
    //     event.should.have.property("sourceName");
    //     event.should.have.property("time");
    //     event.should.have.property("receiveTime");
    //     event.should.have.property("localTime");
    //     event.should.have.property("message");
    //     event.should.have.property("severity");
    //
    //     event.eventId.should.be.instanceof(Variant);
    //
    //     event.eventId.dataType.should.eql(DataType.ByteString);
    //     event.sourceName.value.should.eql("HelloWorld");
    //     event.receiveTime.value.should.eql(new Date(1789, 6, 14));
    //
    // });

    describe("test AddressSpace#generateEventId", () => {
        it("it should generate different eventId each time", () => {
            const eventType1 = addressSpace.generateEventId().value;
            const eventType2 = addressSpace.generateEventId().value;

            eventType1.toString("hex").should.not.eql(eventType2.toString("hex"));
            // xx console.log(eventType1.toString("hex"), eventType2.toString("hex"));
        });
    });
});
