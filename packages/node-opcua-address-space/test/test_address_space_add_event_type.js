"use strict";
/* global describe,it,before*/

const should = require("should");
const _ = require("underscore");


const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;


const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const Variant = require("node-opcua-variant").Variant;


require("../src/address_space_add_enumeration_type");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("AddressSpace : add event type ", function () {

    let addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            const eventType = addressSpace.addEventType({
                browseName: "MyCustomEvent",
                //isAbstract:false,
                subtypeOf: "BaseEventType" // should be implicit
            });
            done(err);
        });
    });

    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });

    it("#generateEventId should generate event id sequentially", function () {

        const id1 = addressSpace.generateEventId();
        const id2 = addressSpace.generateEventId();
        const id3 = addressSpace.generateEventId();
        //xx console.log(id1.value.toString("hex"));
        //xx console.log(id2.value.toString("hex"));
        //xx console.log(id3.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id2.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id3.value.toString("hex"));
    });

    it("should find BaseEventType", function () {
        addressSpace.findEventType("BaseEventType").nodeId.toString().should.eql("ns=0;i=2041");
    });

    it("BaseEventType should be abstract ", function () {
        const baseEventType = addressSpace.findEventType("BaseEventType");
        baseEventType.nodeId.toString().should.eql("ns=0;i=2041");
        baseEventType.isAbstract.should.eql(true);
    });

    it("should find AuditEventType", function () {
        const auditEventType = addressSpace.findEventType("AuditEventType");
        auditEventType.nodeId.toString().should.eql("ns=0;i=2052");
        auditEventType.isAbstract.should.eql(true);
    });

    it("should verify that AuditEventType is a superType of BaseEventType", function () {

        const baseEventType = addressSpace.findObjectType("BaseEventType");
        const auditEventType = addressSpace.findObjectType("AuditEventType");
        auditEventType.isSupertypeOf(baseEventType).should.eql(true);
        baseEventType.isSupertypeOf(auditEventType).should.eql(false);
    });

    it("should find a newly added EventType", function () {

        should(addressSpace.findEventType("__EventTypeForTest1")).eql(null);

        const eventType = addressSpace.addEventType({
            browseName: "__EventTypeForTest1",
            subtypeOf: "BaseEventType" // should be implicit
        });
        eventType.browseName.toString().should.eql("__EventTypeForTest1");

        const reloaded = addressSpace.findEventType("__EventTypeForTest1");
        should(reloaded).not.eql(null, "cannot findEventType " + "__EventTypeForTest1");
        reloaded.nodeId.should.eql(eventType.nodeId);

    });

    it("added EventType should be abstract by default", function () {
        const eventType = addressSpace.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");
        eventType.isAbstract.should.eql(true);
    });

    it("should be possible to add a non-abstract event type", function () {

        const eventType = addressSpace.addEventType({
            browseName: "MyConcreteCustomEvent",
            isAbstract: false
        });
        eventType.browseName.toString().should.eql("MyConcreteCustomEvent");
        eventType.isAbstract.should.eql(false);
    });


    it("should select node in a EventType using a SelectClause on BaseEventType", function () {

        const constructEventFilter = require("node-opcua-service-filter").constructEventFilter;
        const checkSelectClause = require("../src/check_event_clause").checkSelectClause;


        // browseNodeByTargetName
        const baseEventType = addressSpace.findEventType("BaseEventType");

        const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        eventFilter.selectClauses.length.should.eql(3);

        let statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType, eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);


    });
    it("should select node in a EventType using a SelectClause  n AuditEventType", function () {
        const constructEventFilter = require("node-opcua-service-filter").constructEventFilter;
        const checkSelectClause = require("../src/check_event_clause").checkSelectClause;


        // browseNodeByTargetName
        const auditEventType = addressSpace.findEventType("AuditEventType");

        const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        eventFilter.selectClauses.length.should.eql(3);

        let statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType, eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);

    });


    it("should instantiate a condition efficiently ( more than 1000 per second on a decent computer)", function (done) {

        const Benchmarker = require("node-opcua-benchmarker").Benchmarker;
        const bench = new Benchmarker();

        const eventType = addressSpace.addEventType({
            subtypeOf: "ConditionType",
            browseName: "MyConditionType",
            isAbstract: false
        });

        bench.add("test", function () {
            const condition = addressSpace.instantiateCondition(eventType, {
                browseName: "MyCondition",
                sourceName: {dataType: "String", value: "HelloWorld"},
                conditionSource: null,
                receiveTime: {dataType: "DateTime", value: new Date(1789, 6, 14)}
            });
        })

        .on("cycle", function (message) {
            //xx console.log(message);
        })

        .on("complete", function () {

            console.log("    Fastest is " + this.fastest.name);
            //xx console.log(" count    :  ", this.fastest.count);
            done();
        })

        .run({max_time: 0.1});

    });

    it("#constructEventData ", function () {

        const auditEventType = addressSpace.findObjectType("AuditEventType");

        var data = {
            sourceNode: {dataType: "NodeId", value: resolveNodeId("Server")},
            status: {dataType: "Null"},
            serverId: {dataType: "Null"},
            clientAuditEntryId: {dataType: "Null"},
            clientUserId: {dataType: "Null"},
            actionTimeStamp: {dataType: "Null"}
        };

        var data = addressSpace.constructEventData(auditEventType, data);

        const expected_fields = [
            "$eventDataSource",
            "__nodes",
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

        Object.keys(data).sort().should.eql(expected_fields);
        //xx console.log(JSON.stringify(data,null," "));
    });

    xit("#createEventData should add an basic event type", function () {

        const eventType = addressSpace.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");

        addressSpace.addVariable({
            propertyOf: eventType,
            browseName: "MyCustomEventProperty",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 1.0}
        });

        const event = addressSpace.createEventData("MyCustomEvent", {
            sourceName: {dataType: "String", value: "HelloWorld"},
            receiveTime: {dataType: "DateTime", value: new Date(1789, 6, 14)}
        });

        // event shall have property of BaseEventType
        // see OPC Spec 1.02 : part 5 : page 19 :  6.4.2 BaseEventType
        //
        // EventId     ByteString
        // EventType   NodeId
        // SourceNode  NodeId
        // SourceName  String
        // Time        UtcTime
        // ReceiveTime UtcTime
        // LocalTime   TimeZoneDataType // optional
        // Message     LocalizedText
        // Severity    UInt16

        event.should.have.property("eventId");
        event.should.have.property("eventType");
        event.should.have.property("sourceNode");
        event.should.have.property("sourceName");
        event.should.have.property("time");
        event.should.have.property("receiveTime");
        event.should.have.property("localTime");
        event.should.have.property("message");
        event.should.have.property("severity");

        event.eventId.should.be.instanceof(Variant);

        event.eventId.dataType.should.eql(DataType.ByteString);
        event.sourceName.value.should.eql("HelloWorld");
        event.receiveTime.value.should.eql(new Date(1789, 6, 14));


    });

    describe("test AddressSpace#generateEventId" ,function() {
        
            it("it should generate different eventId each time",function() {
                
                const eventType1 = addressSpace.generateEventId().value;
                const eventType2 = addressSpace.generateEventId().value;

                eventType1.toString("hex").should.not.eql(eventType2.toString("hex"));
                console.log( eventType1.toString("hex"), eventType2.toString("hex"));
            });
        });
});

