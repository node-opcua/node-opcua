"use strict";
require("requirish")._(module);
/* jslint */
/*global require,describe, it, before, after */
var should = require("should");

var server_engine = require("lib/server/server_engine");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var path = require("path");
var assert = require("better-assert");
var util = require("util");

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

var checkSelectClauses = require("lib/tools/tools_event_filter").checkSelectClauses;
var extractEventFields = require("lib/tools/tools_event_filter").extractEventFields;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var subscription_service = require("lib/services/subscription_service");
var SimpleAttributeOperand = subscription_service.SimpleAttributeOperand;


describe("testing Events  ", function () {

    var addressSpace;
    var eventType;
    before(function (done) {
        addressSpace = new AddressSpace();
        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);
        generate_address_space(addressSpace, xml_file, function (err) {
            eventType = addressSpace.addEventType({browseName: "MyEventType"});
            done(err);
        });
    });
    after(function(){
        addressSpace.dispose();
        addressSpace = null;
        eventType = null;
    });

    it("should create a new EventType", function () {
        eventType.browseName.toString().should.eql("MyEventType");
    });

    var EventEmitter = require("events").EventEmitter;

    function Observer() {
    }

    util.inherits(Observer, EventEmitter);

    it("should raise a new EventType", function (done) {

        var serverObject = addressSpace.findNode("Server");
        serverObject.browseName.toString().should.eql("Server");

        var eventType = addressSpace.findEventType("MyEventType");

        var observer = new Observer();

        observer.on_event = function (evtData) {

            console.log(" EVENT RECEIVED :", evtData.sourceName.value);
            evtData.sourceName.dataType.should.eql(DataType.String);

            done();
        };

        serverObject.once("event", observer.on_event.bind(observer));

        serverObject.raiseEvent(eventType, {
            sourceName: {dataType: "String", value: "Hello"},
            sourceNode: {dataType: "NodeId", value: serverObject.nodeId},
            message: {dataType: "String", value: "Hello World"}
        });

    });



    // select clause
    var subscription_service = require("lib/services/subscription_service");
    it("should extract EventData from an select clause", function () {

        var baseEventType = addressSpace.findEventType("BaseEventType");

        var eventFilter = new subscription_service.EventFilter({

            selectClauses: [ // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    typeId: baseEventType.nodeId,
                    browsePath: [
                        {name: "EventId"}
                    ],
                    attributeId: AttributeIds.Value,
                    indexRange: null
                },
                {typeId: baseEventType.nodeId,browsePath: [{name: "SourceNode"}], attributeId: AttributeIds.Value},
                {typeId: baseEventType.nodeId,browsePath: [{name: "SourceName"}], attributeId: AttributeIds.Value},
                {typeId: baseEventType.nodeId,browsePath: [{name: "ReceiveTime"}], attributeId: AttributeIds.Value}
            ],
            whereClause: []
        });
        eventFilter.selectClauses[0].should.be.instanceof(SimpleAttributeOperand);

        var auditEventType = addressSpace.findEventType("AuditEventType");
        //xx var auditEventInstance =  auditEventType.instantiate({browseName: "Instantiation"});
        // if (eventFilter.selectClauses.length===0) {return 0;}
        var selectClauseResults = checkSelectClauses(auditEventType, eventFilter.selectClauses);

        selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
        console.log(selectClauseResults);

        var eventFields = extractEventFields(auditEventType, eventFilter.selectClauses,{__nodes:{}});
        eventFields.length.should.eql(eventFilter.selectClauses.length);

        var eventFieldList = new subscription_service.EventFieldList({
            clientHandle: 1,
            eventFields: /* Array<Variant> */ eventFields
        });
        //xx console.log("xxxx ",eventField.toString());

    });

    it("should filter an event", function (done) {

        var serverObject = addressSpace.findNode("Server");
        serverObject.browseName.toString().should.eql("Server");

        var eventType = addressSpace.findEventType("MyEventType");


        var eventFilter = new subscription_service.EventFilter({
            selectClauses: [ // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    typeId: null,
                    browsePath: [
                        {name: "EventId"}
                    ],
                    attributeId: AttributeIds.Value,
                    indexRange: null
                },
                {browsePath: [{name: "SourceNode"}], attributeId: AttributeIds.Value},
                {browsePath: [{name: "SourceName"}], attributeId: AttributeIds.Value},
                {browsePath: [{name: "ReceiveTime"}], attributeId: AttributeIds.Value}
            ],
            whereClause: []
        });

        var rTime = new Date(1789,6,14);

        var data = {
            sourceName: {dataType: "String", value: "Hello"},
            sourceNode: {dataType: "NodeId", value: serverObject.nodeId},
            message: {dataType: "String", value: "Hello World"},
            receiveTime: {dataType: "DateTime",value: rTime}
        };
        var eventData = addressSpace.constructEventData(eventType,data);

        var eventFields = extractEventFields(eventType,eventFilter.selectClauses,eventData);

        // make sure all event fields are Variant
        eventFields.forEach(function(e){
            e.should.instanceOf(Variant);
        });

        eventFields.length.should.eql(4);
        eventFields.forEach(function(f){ return console.log( f.toString());});

        eventFields[1].value.should.eql(serverObject.nodeId); // sourceNode
        eventFields[2].value.should.eql("Hello");
        eventFields[2].dataType.should.eql(DataType.String); // sourceName
        eventFields[3].dataType.should.eql(DataType.DateTime);

        console.log(" EVENT RECEIVED :", eventData.sourceName.value);
        done();

    });


    //     Area1
    //       |
    //       | hasNotifier
    //     Tank1
    //    /    \
    //   /      \ hasEventSource
    //  Pump   TempSensor
    //
    it("should bubble events up",function(){

        var area1 = addressSpace.createNode({
            nodeClass:   NodeClass.Object,
            browseName:  "Area1",
            organisedBy: "Objects"
        });
        area1.browseName.name.should.eql("Area1");

        var tank1 = addressSpace.createNode({
            nodeClass:   NodeClass.Object,
            browseName:  "Tank1",
            componentOf: area1,
            notifierOf:  area1
        });
        tank1.browseName.name.should.eql("Tank1");

        var pump = addressSpace.createNode({
            nodeClass:     NodeClass.Object,
            browseName:    "Pump",
            componentOf:   tank1,
            eventSourceOf: tank1,
            eventNotifier: 1
        });
        var pumpStartEventType = addressSpace.addEventType({browseName: "PumpStartEventType"});
        pumpStartEventType.browseName.toString().should.eql("PumpStartEventType");
        pumpStartEventType.subtypeOfObj.browseName.toString().should.eql("BaseEventType");

        var receivers = [];
        function spyFunc(object,data) {
            var self =this;
            console.log("object ",self.browseName.toString(), " received Event");
            receivers.push(self.browseName.toString());
        }
        var server = addressSpace.findNode("Server");

        server.on("event",spyFunc.bind(server));
        pump.on("event",spyFunc.bind(pump));
        tank1.on("event",spyFunc.bind(tank1));
        area1.on("event",spyFunc.bind(area1));

        var eventData = {};
        pump.raiseEvent(pumpStartEventType,eventData);

        receivers.should.eql([
            "Server","Pump","Tank1","Area1"
        ])

    });


});
