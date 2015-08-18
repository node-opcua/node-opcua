"use strict";
require("requirish")._(module);
/* jslint */
/*global require,describe, it, before, after */
var should = require("should");
var server_engine = require("lib/server/server_engine");
var ServerEngine = server_engine.ServerEngine;
var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var path = require("path");
var assert = require("better-assert");
var util = require("util");

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

var constructBrowsePathFromQualifiedName = require("lib/tools/tools_browse_path").constructBrowsePathFromQualifiedName;
var checkSelectClauses = require("lib/tools/tools_event_filter").checkSelectClauses;


describe("testing Events  ", function () {

    var address_space;
    var eventType;
    before(function (done) {
        address_space = new AddressSpace();
        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);
        generate_address_space(address_space, xml_file, function (err) {
            eventType = address_space.addEventType({browseName: "MyEventType"});
            done(err);
        });
    });

    it("should create a new EventType", function () {
        eventType.browseName.toString().should.eql("MyEventType");
    });

    var EventEmitter = require("events").EventEmitter;

    function Observer() {
    }

    util.inherits(Observer, EventEmitter);

    it("should raise a new EventType", function (done) {

        var serverObject = address_space.findObject("Server");
        serverObject.browseName.toString().should.eql("Server");

        var eventType = address_space.findEventType("MyEventType");

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

    /**
     *
     * @param referenceBaseName
     *
     * @example:
     *
     *  // returns all children elements with a reference type that derives from "Aggregates"
     *  // (i.e HasProperty, HasComponent, HasOrderedComponent)
     *  var nodes = obj.getChildren("Aggregates");
     *
     *
     */
    var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
    var subscription_service = require("lib/services/subscription_service");
    var SimpleAttributeOperand = subscription_service.SimpleAttributeOperand;

    function browsePath(eventNode, selectClause) {

        assert(selectClause instanceof SimpleAttributeOperand);
        // SimpleAttributeOperand
        var address_space = eventNode.__address_space;

        // navigate to the innerNode specified by the browsePath [ QualifiedName]
        var browsePath = constructBrowsePathFromQualifiedName(eventNode, selectClause.browsePath);

        var browsePathResult = address_space.browsePath(browsePath);
        return browsePathResult;
    }

    var UAVariable = require("lib/address_space/ua_variable").UAVariable;

    /**
     * extract a eventField from a event node, matching the given selectClause
     * @param eventNode
     * @param selectClause
     */
    function extractEventField(eventNode,map, selectClause) {
        var DataValue=require("lib/datamodel/datavalue").DataValue;
        function prepare(dataValue) {
            assert(dataValue instanceof DataValue);
            if(dataValue.statusCode === StatusCodes.Good) {
                return dataValue.value;
            }
            return new Variant({dataType: DataType.StatusCode, value: dataValue.statusCode});
        }
        assert(selectClause instanceof SimpleAttributeOperand);

        var address_space = eventNode.__address_space;
        //console.log(selectClause.toString());
        var browsePathResult = browsePath(eventNode, selectClause);
        //console.log(browsePathResult.toString());

        if (browsePathResult.statusCode === StatusCodes.Good) {
            assert(browsePathResult.targets.length === 1);
            var node = address_space.findObject(browsePathResult.targets[0].targetId);

            var key = node.nodeId.toString();
            if (map[key]) {
                return map[key];
            }
            if (node instanceof UAVariable && selectClause.attributeId === AttributeIds.Value) {

                return prepare(node.readValue(selectClause.indexRange));
            }
            return prepare(node.readAttribute(selectClause.attributeId));

        } else {
            return new Variant({dataType: DataType.StatusCode, value: browsePathResult.statusCode});
        }
        //xx var innerNode =
    }

    /**
     * extract a array of eventFields from a event node, matching the selectClauses
     * @param eventNode
     * @param selectClauses
     */
    function extractEventFields(eventTypeNode, selectClauses,eventData) {
        assert(_.isArray(selectClauses));
        assert(selectClauses.length===0 || selectClauses[0] instanceof SimpleAttributeOperand);
        assert(eventData.hasOwnProperty("__nodes"));
        var nodeValueMap = eventData.__nodes;
        return selectClauses.map(extractEventField.bind(null, eventTypeNode,nodeValueMap));
    }


    // select clause
    var subscription_service = require("lib/services/subscription_service");
    it("should extract EventData from an select clause", function () {

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
        eventFilter.selectClauses[0].should.be.instanceof(SimpleAttributeOperand);

        var auditEventType = address_space.findEventType("AuditEventType");
        //xx var auditEventInstance =  auditEventType.instantiate({browseName: "Instantiation"});
        // if (eventFilter.selectClauses.length===0) {return 0;}
        var selectClauseResults = checkSelectClauses(auditEventType, eventFilter.selectClauses);
        selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
        console.log(selectClauseResults);

        var eventFields = extractEventFields(auditEventType, eventFilter.selectClauses,{__nodes:{}});
        eventFields.length.should.eql(eventFilter.selectClauses.length);

        var eventField = new subscription_service.EventField({
            clientHandle: 1,
            eventFields: /* Array<Variant> */ eventFields
        });
        //xx console.log("xxxx ",eventField.toString());

    });

    it("should filter an event", function (done) {

        var serverObject = address_space.findObject("Server");
        serverObject.browseName.toString().should.eql("Server");

        var eventType = address_space.findEventType("MyEventType");


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
        var eventData = address_space.constructEventData(eventType,data);

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

        var area1 = address_space.addObject({
            browseName:  "Area1",
            organisedBy: "Objects"
        });
        area1.browseName.name.should.eql("Area1");

        var tank1 = address_space.addObject({
            browseName: "Tank1",
            componentOf: area1,
            notifierOf:  area1
        });
        tank1.browseName.name.should.eql("Tank1");

        var pump = address_space.addObject({
            browseName: "Pump",
            componentOf: tank1,
            eventSourceOf: tank1,
            eventNotifier: 1
        });
        var pumpStartEventType = address_space.addEventType({browseName: "PumpStartEventType"});
        pumpStartEventType.browseName.toString().should.eql("PumpStartEventType");


        var receivers = [];
        function spyFunc(object,data) {
            var self =this;
            console.log("object ",self.browseName.toString(), " received Event");
            receivers.push(self.browseName.toString());
        }
        var server = address_space.findObject("Server");

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
