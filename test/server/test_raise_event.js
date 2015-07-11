require("requirish")._(module);
/* jslint */
/*global require,describe, it, before, after */
var should = require("should");
var server_engine = require("lib/server/server_engine");
var ServerEngine =  server_engine.ServerEngine;
var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;


describe("testing Events  ", function () {

    var address_space;
    before(function (done) {
        address_space = new AddressSpace();
        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";
        require("fs").existsSync(xml_file).should.be.eql(true);
        generate_address_space(address_space, xml_file, function (err) {
            done(err);
        });

    });


    it("should create a new EventType",function() {

        var eventType = address_space.addEventType({browseName:"MyEventType"});

    });

    var EventEmitter = require("events").EventEmitter;
    function Observer() {
    }
    util.inherits(Observer, EventEmitter);

    it("should raise a new EventType",function(done) {

        var serverObject = address_space.findObject("Server");
        serverObject.browseName.should.eql("Server");

        var eventType = address_space.findEventType("MyEventType");

        var observer = new Observer();

        observer.on_event = function(evt){
            console.log(" EVENT RECEIVED :",evt.message.value);
            done();
        };

        serverObject.on("event", observer.on_event.bind(observer));

        serverObject.raiseEvent(eventType,{
            sourceNode: { dataType: "NodeId" , value: serverObject.nodeId },
            message: { dataType: "String" , value: "Hello World" }
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
    //xxBaseNode.prototype.getChildren = function (referenceBaseName) {
    //xx    // retrieve any children (i.e all the node are  hierachichal relationship with this node)
    //xx};
    function browsePath(node,browsePath) {

        var root = node;


        for (var i =0;i< browsePath.length;i++) {

        }
    }
    /**
     * extract a eventField from a event node, matching the fiven selectClause
     * @param eventNode
     * @param selectClause
     */
    function extractEventField(eventNode,selectClause) {
        // SimpleAttributeOperand

        // navigate to the innerNode specified by the browsePath [ QualifiedName]
        var innerNode =  browsePath(eventNode,selectClause.browsePath);
    }
    /**
     * extract a array of eventFields from a event node, matching the selectClauses
     * @param eventNode
     * @param selectClauses
     */
    function extractEventFields(eventNode,selectClauses) {
        return selectClauses.map(extractEventField.bind(null,eventNode));
    }

    // select clause
    var subscription_service = require("lib/services/subscription_service");
    it("should extract EventData from an select clause",function() {

        var eventFilter = new subscription_service.EventFilter({
            selectClauses: [ // SimpleAttributeOperand

            ],
            whereClause: [

            ]
        });
        var eventField = new subscription_service.EventField({
            clientHandle: 1,
            eventFields: [ // Variant

            ]
        });

    });

    it("should filter an event",function(done) {
        done();
    });


});
