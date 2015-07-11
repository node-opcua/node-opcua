"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var assert = require("better-assert");
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var Variant = require("lib/datamodel/variant").Variant;

exports.install = function (AddressSpace) {

    /**
     * add a new event type to the address space
     * @method addEventType
     * @param options
     * @param options.browseName {String} the eventType name
     * @param [options.subtypeOf ="BaseEventType"]
     *
     *
     * @example:
     *
     *    var evtType = address_space.findEventType({
     *      browseName: "MyAuditEventType",
     *      subtypeOf:  "AuditEventType"
     *    });
     *
     */
    AddressSpace.prototype.addEventType = function (options) {
        options.subtypeOf = options.subtypeOf || "BaseEventType";
        return this.addObjectType(options);
    };
    /**
     * find an EventType node in the address space
     * @method findEventType
     * @param eventTypeId {String|NodeId} the eventType to instantiate
     *
     * @example
     *
     *     var evtType = address_space.findEventType("AuditEventType");
     *
     */
    AddressSpace.prototype.findEventType = function (eventTypeId) {

        var eventType;
        if (eventTypeId.nodeId) {
            eventType = eventTypeId;
        } else {
            eventType =  this.findObjectType(eventTypeId);
        }

        if (!eventType) {
            return null;
        }
        var baseEventType = this.findObjectType("BaseEventType");
        if (eventType.nodeId === baseEventType.nodeId) {
            return eventType;
        }
        /* eventTypeNode should be subTypeOf("BaseEventType"); */
        if (!eventType.isSupertypeOf(baseEventType)) {
            throw new Error("findEventType: event found is not subType of BaseEventType");
        }
        return eventType;
        // return (eventType.isSupertypeOf(baseEventType) || eventType.nodeId === baseEventType.nodeId)? eventType : null;
    };
    /**
     * @methid instantiateEvent
     * @param options.eventId {String|NodeId} the EventType Identifier to instantiate (type cannot be abstract)
     *
     * instantiateEvent will create the unique EventId
     * and will set eventType
     * @param eventTypeId {String|NodeId} the eventType to instantiate
     */
    AddressSpace.prototype.instantiateEvent = function (eventTypeId, options) {

        var self = this;

        // assert(_.isString(options.browseName));
        /**
         *
         * @returns {ByteString}
         * @private
         */
        function _generate_new_event_id() {
            // TODO
            return new Buffer([1, 2, 3, 4]);
        }

        options.eventId = { value:  _generate_new_event_id() , dataType : "ByteString" };

        var eventTypeNode = self.findEventType(eventTypeId);

        /* istanbul ignore next */
        if (!eventTypeNode) {
            throw new Error(" cannot find EvenType for " + eventTypeId);
        }

        if (eventTypeNode.isAbstract) {
            throw new Error("cannot instanciate abstract EvenType");
        }

        options.browseName = options.browseName || "???";

        var eventNode = eventTypeNode.instantiate({
            browseName: options.browseName,
            //xx organizedBy: "i=58"
        });


        // set properties
        Object.keys(options).forEach(function (key) {

            // ignore special attributes
            if (key === "browseName") {
                return;
            }
            //xxconsole.log(" Kkey =",key, " options =",options[key]);
            assert(eventNode.hasOwnProperty(key));

            var varNode = eventNode[key];
            assert(varNode instanceof UAVariable);

            var variant = new Variant(options[key]);
            //xx console.log("xxxx ",variant);
            //xx console.log("xxxx ",varNode.toString());

            // check that Variant DataType is compatible with the UAVariable dataType
            var nodeDataType = self.findObject(varNode.dataType).browseName;

            if (!varNode._validate_DataType(variant.dataType)) {
                throw new Error(" Invalid variant dataType");
            }

            varNode.setValueFromSource(new Variant(options[key]));

        });
        //xx console.log("eventNode",eventNode.toString());


        return eventNode;

    };
};