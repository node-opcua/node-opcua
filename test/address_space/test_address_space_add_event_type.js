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

var assert = require("assert");
var path = require("path");

require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : add event type ", function () {

    var address_space;
    before(function (done) {
        address_space = new AddressSpace();

        var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            var eventType = address_space.addEventType({
                browseName: "MyCustomEvent",
                //isAbstract:false,
                subtypeOf: "BaseEventType" // should be implicit
            });


            done(err);
        });

    });

    it("#generateEventId should generate event id sequentially",function() {

        var id1 = address_space.generateEventId();
        var id2 = address_space.generateEventId();
        var id3 = address_space.generateEventId();
        console.log(id1.value.toString("hex"));
        console.log(id2.value.toString("hex"));
        console.log(id3.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id2.value.toString("hex"));
        id1.value.toString("hex").should.not.eql(id3.value.toString("hex"));
    });

    it("should find BaseEventType", function () {
        address_space.findEventType("BaseEventType").nodeId.toString().should.eql("ns=0;i=2041");
    });

    it("BaseEventType should be abstract ", function () {
        var baseEventType = address_space.findEventType("BaseEventType");
        baseEventType.nodeId.toString().should.eql("ns=0;i=2041");
        baseEventType.isAbstract.should.eql(true);
    });

    it("should find AuditEventType", function () {
        var auditEventType = address_space.findEventType("AuditEventType");
        auditEventType.nodeId.toString().should.eql("ns=0;i=2052");
        auditEventType.isAbstract.should.eql(true);
    });

    it("should verify that AuditEventType is a superType of BaseEventType", function () {

        var baseEventType = address_space.findObjectType("BaseEventType");
        var auditEventType = address_space.findObjectType("AuditEventType");
        auditEventType.isSupertypeOf(baseEventType).should.eql(true);
        baseEventType.isSupertypeOf(auditEventType).should.eql(false);
    });

    it("should find a newly added EventType", function () {

        should(address_space.findEventType("__EventTypeForTest1")).eql(null);

        var eventType = address_space.addEventType({
            browseName: "__EventTypeForTest1",
            subtypeOf: "BaseEventType" // should be implicit
        });
        eventType.browseName.toString().should.eql("__EventTypeForTest1");

        var reloaded = address_space.findEventType("__EventTypeForTest1");
        should(reloaded).not.eql(null, "cannot findEventType " + "__EventTypeForTest1");
        reloaded.nodeId.should.eql(eventType.nodeId);

    });

    it("added EventType should be abstract by default", function () {
        var eventType = address_space.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");
        eventType.isAbstract.should.eql(true);
    });

    it("should be possible to add a non-abstract event type",function(){

        var eventType = address_space.addEventType({
            browseName: "MyConcreteCustomEvent",
            isAbstract: false,
        });
        eventType.browseName.toString().should.eql("MyConcreteCustomEvent");
        eventType.isAbstract.should.eql(false);
    });



    it("should instantiate event efficiently ( more than 1000 per second on a decent computer)", function (done) {

        var Benchmarker = require("test/helpers/benchmarker").Benchmarker;
        var bench = new Benchmarker();

        var eventType = address_space.addEventType({
            browseName: "MyConcreteCustomEvent2",
            isAbstract: false
        });
        bench.add('test', function () {

            var event = address_space.instantiateEvent(eventType, {
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

        var auditEventType = address_space.findObjectType("AuditEventType");

        var data = address_space.constructEventData(auditEventType);

        var expected_fields = [
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

        var eventType = address_space.findEventType("MyCustomEvent");
        eventType.browseName.toString().should.eql("MyCustomEvent");

        address_space.addProperty(eventType, {
            browseName: "MyCustomEventProperty",
            dataType: "Double",
            hasTypeDefinition: "BaseDataVariableType", // ???
            value: {dataType: DataType.Double, value: 1.0}
        });

        var event = address_space.createEventData("MyCustomEvent", {
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

        var auditEventType = address_space.findObjectType("AuditEventType");

        var data = {
            sourceName: {dataType: "String", value: "HelloWorld"},
            receiveTime: {dataType: "DateTime", value: new Date(1789, 6, 14)}
        };

        var fullData = address_space.deprecated_createEventData(auditEventType, data);

        fullData.sourceName.value.should.eql("HelloWorld");
    });
});
