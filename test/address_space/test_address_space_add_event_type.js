"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var Enum = require("lib/misc/enum");
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var assert = require("assert");
var path = require("path");

require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : add event type ", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                var eventType = addressSpace.addEventType({
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
    });

    it("#generateEventId should generate event id sequentially",function() {

        var id1 = addressSpace.generateEventId();
        var id2 = addressSpace.generateEventId();
        var id3 = addressSpace.generateEventId();
        console.log(id1.value.toString("hex"));
        console.log(id2.value.toString("hex"));
        console.log(id3.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id2.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id3.value.toString("hex"));
    });

    it("should find BaseEventType", function () {
        addressSpace.findEventType("BaseEventType").nodeId.toString().should.eql("ns=0;i=2041");
    });

    it("BaseEventType should be abstract ", function () {
        var baseEventType = addressSpace.findEventType("BaseEventType");
        baseEventType.nodeId.toString().should.eql("ns=0;i=2041");
        baseEventType.isAbstract.should.eql(true);
    });

    it("should find AuditEventType", function () {
        var auditEventType = addressSpace.findEventType("AuditEventType");
        auditEventType.nodeId.toString().should.eql("ns=0;i=2052");
        auditEventType.isAbstract.should.eql(true);
    });

    it("should verify that AuditEventType is a superType of BaseEventType", function () {

        var baseEventType = addressSpace.findObjectType("BaseEventType");
        var auditEventType = addressSpace.findObjectType("AuditEventType");
        auditEventType.isSupertypeOf(baseEventType).should.eql(true);
        baseEventType.isSupertypeOf(auditEventType).should.eql(false);
    });

    it("should find a newly added EventType", function () {

        should(addressSpace.findEventType("__EventTypeForTest1")).eql(null);

        var eventType = addressSpace.addEventType({
            browseName: "__EventTypeForTest1",
            subtypeOf: "BaseEventType" // should be implicit
        });
        eventType.browseName.toString().should.eql("__EventTypeForTest1");

        var reloaded = addressSpace.findEventType("__EventTypeForTest1");
        should(reloaded).not.eql(null, "cannot findEventType " + "__EventTypeForTest1");
        reloaded.nodeId.should.eql(eventType.nodeId);

    });

    it("added EventType should be abstract by default", function () {
        var eventType = addressSpace.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");
        eventType.isAbstract.should.eql(true);
    });

    it("should be possible to add a non-abstract event type",function(){

        var eventType = addressSpace.addEventType({
            browseName: "MyConcreteCustomEvent",
            isAbstract: true
        });
        eventType.browseName.toString().should.eql("MyConcreteCustomEvent");
        eventType.isAbstract.should.eql(true);
    });


    it("should select node in a EventType using a SelectClause on BaseEventType",function() {
        var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;
        var checkSelectClause = require("lib/tools/tools_event_filter").checkSelectClause;


        // browseNodeByTargetName
        var baseEventType = addressSpace.findEventType("BaseEventType");

        var eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        eventFilter.selectClauses.length.should.eql(3);

        var statusCode = checkSelectClause(baseEventType,eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType,eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(baseEventType,eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);



    });
    it("should select node in a EventType using a SelectClause  n AuditEventType",function() {
        var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;
        var checkSelectClause = require("lib/tools/tools_event_filter").checkSelectClause;


        // browseNodeByTargetName
        var auditEventType = addressSpace.findEventType("AuditEventType");

        var eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
        eventFilter.selectClauses.length.should.eql(3);

        var statusCode = checkSelectClause(auditEventType,eventFilter.selectClauses[0]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType,eventFilter.selectClauses[1]);
        statusCode.should.eql(StatusCodes.Good);

        statusCode = checkSelectClause(auditEventType,eventFilter.selectClauses[2]);
        statusCode.should.eql(StatusCodes.Good);

    });


    it("should instantiate event efficiently ( more than 1000 per second on a decent computer)", function (done) {

        var Benchmarker = require("test/helpers/benchmarker").Benchmarker;
        var bench = new Benchmarker();

        var eventType = addressSpace.addEventType({
            browseName: "MyConcreteCustomEvent2",
            isAbstract: false
        });
        bench.add('test', function () {

            var event = addressSpace.instantiateEvent(eventType, {
                sourceName: {dataType: "String", value: "HelloWorld"},
                receiveTime: {dataType: "DateTime", value: new Date(1789, 6, 14)}
            });
        })

            .on('cycle', function (message) {
                console.log(message);
            })

            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                //xx console.log(' count    :  ', this.fastest.count);
                done();
            })

            .run({max_time: 0.1});

    });

    it("#constructEventData ", function () {

        var auditEventType = addressSpace.findObjectType("AuditEventType");

        var data = {
            sourceNode: { dataType: "NodeId", value:  resolveNodeId("Server") },
            status:     { dataType: "Null"},
            serverId:     { dataType: "Null"},
            clientAuditEntryId:     { dataType: "Null"},
            clientUserId:        { dataType: "Null"},
            actionTimeStamp:     { dataType: "Null"}
            };

        var data = addressSpace.constructEventData(auditEventType,data);

        var expected_fields = [
            "$eventType",
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

        var eventType = addressSpace.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");

        addressSpace.addVariable( {
            propertyOf: eventType,
            browseName: "MyCustomEventProperty",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 1.0}
        });

        var event = addressSpace.createEventData("MyCustomEvent", {
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

        //  var UAVariable = require("lib/address_space/ua_variable").UAVariable;
        var Variant = require("lib/datamodel/variant").Variant;
        event.eventId.should.be.instanceof(Variant);

        event.eventId.dataType.should.eql(DataType.ByteString);
        event.sourceName.value.should.eql("HelloWorld");
        event.receiveTime.value.should.eql(new Date(1789, 6, 14));

    });
    xit("#createEventData ", function () {

        var auditEventType = addressSpace.findObjectType("AuditEventType");

        var data = {
            sourceName: {dataType: "String", value: "HelloWorld"},
            receiveTime: {dataType: "DateTime", value: new Date(1789, 6, 14)}
        };

        var fullData = addressSpace.deprecated_createEventData(auditEventType, data);

        fullData.sourceName.value.should.eql("HelloWorld");
    });
});
