"use strict";

/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var UAMethod = require("lib/address_space/ua_method").UAMethod;
var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;

var doDebug = false;


var BaseNode = require("lib/address_space/base_node").BaseNode;

var browse_path_tools = require("lib/tools/tools_browse_path");
var constructBrowsePathFromQualifiedName = browse_path_tools.constructBrowsePathFromQualifiedName;

var subscription_service = require("lib/services/subscription_service");
var SimpleAttributeOperand = subscription_service.SimpleAttributeOperand;

var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var context = require("lib/server/session_context").SessionContext.defaultContext;

/**
 * @class EventData
 * @param eventTypeNode {BaseNode}
 * @constructor
 */
function EventData(eventTypeNode) {
    this.__nodes = {};
    this.$eventDataSource = eventTypeNode;
    assert(eventTypeNode instanceof BaseNode);
}

/**
 * @method resolveSelectClause
 * @param selectClause {SimpleAttributeOperand}
 * @returns {NodeId|null}
 */
EventData.prototype.resolveSelectClause = function(selectClause) {
    var self = this;
    assert(selectClause instanceof SimpleAttributeOperand);
    var addressSpace = self.$eventDataSource.addressSpace;

    // navigate to the innerNode specified by the browsePath [ QualifiedName]
    var browsePath = constructBrowsePathFromQualifiedName(self.$eventDataSource, selectClause.browsePath);
    var browsePathResult = addressSpace.browsePath(browsePath);
    //xx console.log(" br",self.$eventDataSource.nodeId.toString(),selectClause.browsePath.toString(),browsePathResult.targets[0] ? browsePathResult.targets[0].targetId.toString() : "!!!NOT FOUNF!!!".cyan)
    if (browsePathResult.statusCode != StatusCodes.Good) {
        return null;
    }
    // istanbul ignore next
    if (browsePathResult.targets.length !== 1) {
        //xx console.log("selectClause ",selectClause.toString());
        //xx console.log("browsePathResult ",browsePathResult.toString());
        //xx throw new Error("browsePathResult.targets.length !== 1"  + browsePathResult.targets.length);
    }
    return browsePathResult.targets[0].targetId;
};

function prepare(dataValue) {
    assert(dataValue instanceof DataValue);
    if(dataValue.statusCode === StatusCodes.Good) {
        return dataValue.value;
    }
    return new Variant({dataType: DataType.StatusCode, value: dataValue.statusCode});
}



EventData.prototype.setValue = function(lowerName,node,variant) {
    var eventData = this;
    eventData[lowerName] = Variant.coerce(variant);/// _coerceVariant(variant);
    eventData.__nodes[node.nodeId.toString()] = eventData[lowerName];
};

/**
 * @method readValue
 * @param nodeId {NodeId}
 * @param selectClause {SimpleAttributeOperand}
 * @returns {Variant}
 */
EventData.prototype.readValue = function(nodeId,selectClause) {
    assert(nodeId instanceof NodeId);
    assert(selectClause instanceof SimpleAttributeOperand);
    var self = this;
    assert(nodeId instanceof NodeId);
    var addressSpace = this.$eventDataSource.addressSpace;

    var node = addressSpace.findNode(nodeId);

    var key = node.nodeId.toString();

    // if the value exists in cache ... we read it from cache...
    var cached_value =self.__nodes[key];
    if (cached_value) {
        return cached_value;
    }

    if (node instanceof UAVariable && selectClause.attributeId === AttributeIds.Value) {
        return prepare(node.readValue(context, selectClause.indexRange));
    }
    return prepare(node.readAttribute(context, selectClause.attributeId));

};

exports.EventData = EventData;




exports.install = function (AddressSpace) {


    /**
     * add a new event type to the address space
     * @method addEventType
     * @param options
     * @param options.browseName {String} the eventType name
     * @param [options.subtypeOf ="BaseEventType"]
     * @param [options.isAbstract = true]
     * @return {UAObjectType} : the object type
     *
     * @example
     *
     *      var evtType = addressSpace.addEventType({
     *          browseName: "MyAuditEventType",
     *          subtypeOf:  "AuditEventType"
     *      });
     *      var myConditionType = addressSpace.addEventType({
     *          browseName: "MyConditionType",
     *          subtypeOf:  "ConditionType",
     *          isAbstract: false
     *      });
     *
     */
    AddressSpace.prototype.addEventType = function (options) {
        options.subtypeOf = options.subtypeOf || "BaseEventType";
        // are eventType always abstract ?? No => Condition can be instantiated!
        // but, by default is abstract is true
        options.isAbstract = options.hasOwnProperty("isAbstract") ? !!options.isAbstract : true;
        return this.addObjectType(options);
    };

    //function _coerceEventType(addressSpace, eventType) {
    //
    //    var nodeid = makeNodeId(ObjectTypeIds[eventType]);
    //    var eventTypeNode = addressSpace.findNode(nodeid);
    //    return eventTypeNode;
    //}
    /**
     * find an EventType node in the address space
     * @method findEventType
     * @param eventTypeId {String|NodeId|UAObjectType} the eventType to find
     * @param namespace the namespace index of the event to find
     * @return {UAObjectType|null} the EventType found or null.
     *
     * note:
     *    - the method with throw an exception if a node is found
     *      that is not a BaseEventType or a subtype of it.
     *
     * @example
     *
     *     var evtType = addressSpace.findEventType("AuditEventType");
     *
     */
    AddressSpace.prototype.findEventType = function (eventTypeId,namespace) {

        var eventType;
        if (eventTypeId && eventTypeId.nodeId) {
            eventType = eventTypeId;
        } else {
            eventType = this.findObjectType(eventTypeId,namespace);
        }
        if (!eventType) {
            return null;
        }
        var baseEventType = this.findObjectType("BaseEventType");
        assert(baseEventType,"expecting BaseEventType - please check you nodeset xml file!");

        if (eventType.nodeId === baseEventType.nodeId) {
            return eventType;
        }
        /* eventTypeNode should be isSupertypeOf("BaseEventType"); */
        /* istanbul ignore next */
        if (!eventType.isSupertypeOf(baseEventType)) {
            throw new Error("findEventType: event found is not subType of BaseEventType");
        }
        return eventType;
        // return (eventType.isSupertypeOf(baseEventType) || eventType.nodeId === baseEventType.nodeId)? eventType : null;
    };

    /**
     * EventId is generated by the Server to uniquely identify a particular Event Notification.
     * @method generateEventId
     * @return {Variant}  dataType: "ByteString"
     */
    AddressSpace.prototype.generateEventId = function () {
        /*
         * OpcUA 1.02 part 5 : 6.4.2 BaseEventType
         * The Server is responsible to ensure that each Event has its unique EventId.
         * It may do this, for example, by putting GUIDs into the ByteString.
         * Clients can use the EventId to assist in minimizing or eliminating gaps and overlaps that may occur during
         * a redundancy fail-over. The EventId shall always be returned as value and the Server is not allowed to
         * return a StatusCode for the EventId indicating an error.
         *
         */
        var self = this;
        var offset = 16;
        if(!self._eventIdCounter) {
             self._eventIdCounter = require("crypto").randomBytes(20);
             self._eventIdCounter.writeInt32BE(0,offset);
        }
        self._eventIdCounter.writeInt32BE(self._eventIdCounter.readInt32BE(offset)+1,offset);

        return new Variant({value: Buffer.from(self._eventIdCounter), dataType: "ByteString"});
    };

    /*=
     * construct a simple javascript object with all the default properties of the event
     * @method constructEventData
     *
     * @return result.$eventDataSource {BaseNode} the event type node
     * @return result.eventId {NodeId} the
     * ...
     *
     *
     * eventTypeId can be a UAObjectType deriving from EventType
     * or an instance of a ConditionType
     *
     * @private
     */
    AddressSpace.prototype.constructEventData = function (eventTypeId, data) {

        var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;

        var addressSpace = this;

        data = data || {};

        // construct the reference dataStructure to store event Data
        var eventTypeNode  = eventTypeId;

        if (eventTypeId instanceof UAObjectType) {
            eventTypeNode = addressSpace.findEventType(eventTypeId);
        }


        /* istanbul ignore next */
        if (!eventTypeNode) {
            throw new Error(" cannot find EvenType for " + eventTypeId);
        }
        assert(eventTypeNode instanceof UAObjectType,"eventTypeId must represent a UAObjectType");

        // eventId
        assert(data.hasOwnProperty,"eventId","constructEventData : options object should not have eventId property");
        data.eventId = data.eventId || addressSpace.generateEventId();

        // eventType
        data.eventType = { dataType: DataType.NodeId, value: eventTypeNode.nodeId};

        // sourceNode
        assert(data.hasOwnProperty("sourceNode"), "expecting a source node to be defined");
        data.sourceNode = new Variant(data.sourceNode);
        assert(data.sourceNode.dataType ===  DataType.NodeId);

        // sourceName
        var sourceNode = addressSpace.findNode(data.sourceNode.value);

        data.sourceName = data.sourceName || { dataType:  DataType.String, value: sourceNode.getDisplayName("en") };

        var nowUTC = (new Date());

        // time (UtcTime)
        // TODO
        data.time = data.time  ||  { dataType: DataType.DateTime, value: nowUTC};

        // receivedTime  (UtcTime)
        // TODO
        data.receiveTime = data.receiveTime  ||  { dataType: DataType.DateTime, value: nowUTC};

        // localTime  (UtcTime)
        // TODO
        data.localTime = data.localTime  ||  { dataType: DataType.DateTime, value: nowUTC};

        // message  (LocalizedText)
        data.message = data.message  ||  { dataType: DataType.LocalizedText, value: { text: "" } };

        // severity  (UInt16)
        data.severity = data.severity  ||  { dataType: DataType.UInt16, value: 0 };

        //xx // reminder : event type cannot be instantiated directly !
        //xx assert(eventTypeNode.isAbstract);

        var baseObjectType = addressSpace.findObjectType("BaseObjectType"); // i=58
        assert(baseObjectType, "BaseObjectType must be defined in the address space");

        var visitedProperties = [];

        function _process_var(self,prefix,node) {
            var lowerName =prefix + lowerFirstLetter(node.browseName.name);
            // istanbul ignore next
            if (doDebug) { console.log("      "+lowerName.toString()); }
            visitedProperties[lowerName] = node;
            if (data.hasOwnProperty(lowerName)) {

                eventData.setValue(lowerName,node,data[lowerName]);
                //xx eventData[lowerName] = _coerceVariant(data[lowerName]);
            } else {

                // add a property , but with a null variant
                eventData.setValue(lowerName,node,{ dataType: DataType.Null});
                //xx  eventData[lowerName] =  _coerceVariant({ dataType: DataType.Null});

                if (node.modellingRule === "Mandatory") {
                    console.log("ERROR : AddressSpace#constructEventData(eventType,options) cannot find property ".red
                        + self.browseName.toString()+ " => "+ lowerName.cyan );
                } else {
                    console.log("Warning : AddressSpace#constructEventData(eventType,options) cannot find property ".yellow
                        + self.browseName.toString()+ " => "+ lowerName.cyan );
                }
                //xx data[lowerName] = node.readValue().value;
            }

        }

        function populate_data(self, eventData) {

            if (baseObjectType.nodeId === self.nodeId) {
                return; // nothing to do
            }

            var baseTypeNodeId = self.subtypeOf;
            // istanbul ignore next
            if (!baseTypeNodeId) {
                throw new Error("Object " + self.browseName.toString() + " with nodeId " + self.nodeId + " has no Type");
            }

            var baseType = addressSpace.findNode(baseTypeNodeId);
            // istanbul ignore next
            if (!baseType) {
                throw new Error("Cannot find object with nodeId ".red + baseTypeNodeId);
            }

            populate_data(baseType, eventData);

            // get properties and components from base class
            var properties = self.getProperties();
            var components = self.getComponents();
            var children = [].concat(properties,components);

            // istanbul ignore next
            if (doDebug) { console.log(" "+self.browseName.toString().bgWhite.cyan ); }

            children.forEach(function (node) {

                // only keep those that have a "HasModellingRule"
                if (node.modellingRule === null) {
                    //xx console.log(" skipping node without modelling rule", node.browseName.toString());
                    return;
                }
                // ignore also methods
                if (node instanceof UAMethod) {
                    //xx console.log(" skipping method ", node.browseName.toString());
                    return;
                }


                _process_var(self,"",node);

                // also store value in index
                //xx eventData.__nodes[node.nodeId.toString()] = eventData[lowerName];

                var children =node.getAggregates();
                if (children.length >0) {
                    var lowerName =lowerFirstLetter(node.browseName.name);
                    //xx console.log(" Children to visit = ",lowerName,children.map(function(a){ return a.browseName.toString();}).join(" "));
                    children.map(function(child) {
                        _process_var(self,lowerName + ".",child);
                    });

                }
            });
        }

        var eventData = new EventData(eventTypeNode);

        // verify standard properties...
        populate_data(eventTypeNode, eventData);

        // verify that all elements of data are valid
        function verify_data_is_valid(){
            Object.keys(data).map(function(k) {
                if(k === "$eventDataSource") {
                    return;
                }
                if (!visitedProperties.hasOwnProperty(k)) {
                    throw new Error(" cannot find property '" + k + "' in [ "
                        + Object.keys(visitedProperties).join(", ") + "] when filling " +
                        eventTypeNode.browseName.toString() );
                }
            });
        }
        verify_data_is_valid();

        return eventData;
    };
};
