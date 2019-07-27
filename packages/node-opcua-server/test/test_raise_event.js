"use strict";

/* jslint */
/*global require,describe, it, before, after */
const should = require("should");

const NodeClass = require("node-opcua-data-model").NodeClass;

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const AttributeIds = require("node-opcua-data-model").AttributeIds;
const util = require("util");

const getMiniAddressSpace = require("node-opcua-address-space").getMiniAddressSpace;

const checkSelectClauses = require("node-opcua-address-space").checkSelectClauses;
const extractEventFields = require("node-opcua-service-filter").extractEventFields;

const filter_service = require("node-opcua-service-filter");
const SimpleAttributeOperand = require("node-opcua-service-filter").SimpleAttributeOperand;
const EventFilter = require("node-opcua-service-filter").EventFilter;

const EventData = require("node-opcua-address-space").EventData;
// select clause
const subscription_service = require("node-opcua-service-subscription");



describe("testing Events  ", function () {

    let addressSpace,namespace;
    let eventType;
    before(function (done) {
        getMiniAddressSpace(function (err,__addressSpace__) {
            addressSpace =__addressSpace__;
            namespace = addressSpace.getOwnNamespace();

            eventType = namespace.addEventType({browseName: "SomeEventType"});
            done(err);
        });
    });
    after(function(){
        addressSpace.dispose();
        addressSpace = null;
        eventType = null;
    });

    it("should create a new EventType", function () {
        eventType.browseName.toString().should.eql("1:SomeEventType");
    });

    const EventEmitter = require("events").EventEmitter;

    function Observer() {
    }

    util.inherits(Observer, EventEmitter);

    it("should raise a new transitory event of  EventType", function (done) {

        const serverObject = addressSpace.findNode("Server");
        serverObject.browseName.toString().should.eql("Server");

        const eventType = addressSpace.findEventType("1:SomeEventType");

        const observer = new Observer();

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



    it("should extract EventData from an select clause", function () {



        const baseEventType = addressSpace.findEventType("BaseEventType");

        const eventFilter = new filter_service.EventFilter({

            selectClauses: [ // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    typeDefinitionId: baseEventType.nodeId,
                    browsePath: [
                        {name: "EventId"}
                    ],
                    attributeId: AttributeIds.Value,
                    indexRange: null
                },
                {typeDefinitionId: baseEventType.nodeId,browsePath: [{name: "SourceNode"}], attributeId: AttributeIds.Value},
                {typeDefinitionId: baseEventType.nodeId,browsePath: [{name: "SourceName"}], attributeId: AttributeIds.Value},
                {typeDefinitionId: baseEventType.nodeId,browsePath: [{name: "ReceiveTime"}], attributeId: AttributeIds.Value}
            ],
            whereClause: []
        });
        eventFilter.selectClauses[0].should.be.instanceof(SimpleAttributeOperand);

        const auditEventType = addressSpace.findEventType("AuditEventType");
        //xx var auditEventInstance =  auditEventType.instantiate({browseName: "Instantiation"});
        // if (eventFilter.selectClauses.length===0) {return 0;}
        const selectClauseResults = checkSelectClauses(auditEventType, eventFilter.selectClauses);

        selectClauseResults.length.should.eql(eventFilter.selectClauses.length);

        //xx console.log(selectClauseResults);

        const eventData = new EventData(baseEventType);

        const eventFields = extractEventFields(eventFilter.selectClauses,eventData);


        eventFields.length.should.eql(eventFilter.selectClauses.length);

        const eventFieldList = new subscription_service.EventFieldList({
            clientHandle: 1,
            eventFields: /* Array<Variant> */ eventFields
        });
        //xx console.log("xxxx ",eventField.toString());

    });

    it("should filter an event", function (done) {

        const serverObject = addressSpace.findNode("Server");
        serverObject.browseName.toString().should.eql("Server");

        // myEventType is on the Simulation namespace
        const eventType = addressSpace.findEventType("1:SomeEventType");

        should.exist(eventType);


        const eventFilter = new EventFilter({
            selectClauses: [ // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    typeDefinitionId: null,
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

        const rTime = new Date(1789,6,14);

        const data = {
            sourceName: {dataType: "String", value: "Hello"},
            sourceNode: {dataType: "NodeId", value: serverObject.nodeId},
            message: {dataType: "String", value: "Hello World"},
            receiveTime: {dataType: "DateTime",value: rTime}
        };
        const eventData = addressSpace.constructEventData(eventType,data);

        const eventFields = extractEventFields(eventFilter.selectClauses,eventData);

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

        const area1 = namespace.createNode({
            nodeClass: NodeClass.Object,
            browseName:  "Area1",
            organizedBy: addressSpace.rootFolder.objects
        });
        area1.browseName.name.should.eql("Area1");

        const tank1 = namespace.createNode({
            nodeClass: NodeClass.Object,
            browseName:  "Tank1",
            componentOf: area1,
            notifierOf:  area1
        });
        tank1.browseName.name.should.eql("Tank1");

        const pump = namespace.createNode({
            nodeClass: NodeClass.Object,
            browseName:    "Pump",
            componentOf:   tank1,
            eventSourceOf: tank1,
            eventNotifier: 1
        });
        const pumpStartEventType = namespace.addEventType({browseName: "PumpStartEventType"});
        pumpStartEventType.browseName.toString().should.eql("1:PumpStartEventType");
        pumpStartEventType.subtypeOfObj.browseName.toString().should.eql("BaseEventType");

        const receivers = [];
        function spyFunc(object,data) {
            const self =this;
            console.log("object ",self.browseName.toString(), " received Event");
            receivers.push(self.browseName.name.toString());
        }
        const server = addressSpace.findNode("Server");

        server.on("event",spyFunc.bind(server));
        pump.on("event",spyFunc.bind(pump));
        tank1.on("event",spyFunc.bind(tank1));
        area1.on("event",spyFunc.bind(area1));

        const eventData = {};
        pump.raiseEvent(pumpStartEventType,eventData);

        receivers.should.eql([
            "Server","Pump","Tank1","Area1"
        ]);

    });


});
