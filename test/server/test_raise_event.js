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
    before(function (done) {
        address_space = new AddressSpace();
        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);
        generate_address_space(address_space, xml_file, function (err) {
            done(err);
        });
    });

    it("should create a new EventType", function () {
        var eventType = address_space.addEventType({browseName: "MyEventType"});
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

        observer.on_event = function (evt) {
            console.log(" EVENT RECEIVED :", evt.message.value);
            done();
        };

        serverObject.on("event", observer.on_event.bind(observer));

        serverObject.raiseEvent(eventType, {
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

    function browsePath(eventNode, selectClause) {
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
    function extractEventField(eventNode, selectClause) {

        var address_space = eventNode.__address_space;
        //console.log(selectClause.toString());
        var browsePathResult = browsePath(eventNode, selectClause);
        //console.log(browsePathResult.toString());

        if (browsePathResult.statusCode === StatusCodes.Good) {
            assert(browsePathResult.targets.length === 1);
            var node = address_space.findObject(browsePathResult.targets[0].targetId);
            if (node instanceof UAVariable && selectClause.attributeId === AttributeIds.Value) {

                return node.readValue(selectClause.indexRange);
            }
            return node.readAttribute(selectClause.attributeId);

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
    function extractEventFields(eventTypeNode, selectClauses) {
        return selectClauses.map(extractEventField.bind(null, eventTypeNode));
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

        var auditEventType = address_space.findEventType("AuditEventType");
        //xx var auditEventInstance =  auditEventType.instantiate({browseName: "Instantiation"});
        // if (eventFilter.selectClauses.length===0) {return 0;}
        var selectClauseResults = checkSelectClauses(auditEventType, eventFilter.selectClauses);
        selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
        console.log(selectClauseResults);

        var eventFields = extractEventFields(auditEventType, eventFilter.selectClauses);
        eventFields.length.should.eql(eventFilter.selectClauses.length);

        var eventField = new subscription_service.EventField({
            clientHandle: 1,
            eventFields: /* Array<Variant> */ eventFields
        });
        //xx console.log("xxxx ",eventField.toString());

    });

    it("should filter an event", function (done) {
        done();
    });


});
