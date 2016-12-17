"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var DataType = require("lib/datamodel/variant").DataType;

var NodeId = require("lib/datamodel/nodeid").NodeId;

exports.install = function (UAObject) {

    var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;


    /**
     * Raise a transient Event
     * @method raiseEvent
     * @param eventType {String|NodeId|UAObject|UAObjectType} the eventType to find
     * @param data
     */
    UAObject.prototype.raiseEvent = function (eventType, data)
    {

        var self = this;
        var addressSpace = self.addressSpace;

        if (typeof(eventType) === "string") {
            eventType = addressSpace.findEventType(eventType);
        }
        if (eventType instanceof NodeId) {
            eventType = addressSpace.findNode(eventType);
        }
        assert(eventType instanceof UAObjectType);

        var eventTypeNode = eventType;
        // istanbul ignore next
        if (!eventTypeNode) {
            throw new Error("UAObject#raiseEventType : Cannot find event type :" + eventType.toString());
        }

        // coerce EventType
        eventTypeNode = addressSpace.findEventType(eventType);
        var baseEventType = addressSpace.findEventType("BaseEventType");
        assert(eventTypeNode.isSupertypeOf(baseEventType));

        data.$eventDataSource = eventTypeNode;
        data.sourceNode = data.sourceNode || {dataType: DataType.NodeId, value: self.nodeId};

        var eventData = addressSpace.constructEventData(eventTypeNode, data);

        self._bubble_up_event(eventData);
    };

    UAObject.prototype._bubble_up_event = function(eventData)
    {
        var self = this;
        var addressSpace = self.addressSpace;

        var queue = [];
        // walk up the hasNotify / hasEventSource chain
        var m = {};

        // all events are notified to the server object
        // emit on server object
        var server = addressSpace.findNode("Server");

        if (server) {
            assert(server.eventNotifier > 0x00, "Server must be an event notifier");
            server.emit("event", eventData);
            m[server.nodeId.toString()] = server;
        } else {
            console.warn("Warning. ".yellow + "UAObject#raiseEvent".cyan + " cannot find Server object on addressSpace".red);
        }

        addinqueue(self);

        function addinqueue(obj) {
            var key = obj.nodeId.toString();
            if (!m[key]) {
                m[key] = obj;
                queue.push(obj);
            }
        }

        while (queue.length) {
            var obj = queue.pop();
            // emit on object itself
            obj.emit("event", eventData);

            var elements1 = obj.findReferencesAsObject("HasNotifier", false);
            elements1.forEach(addinqueue);

            var elements2 = obj.findReferencesAsObject("HasEventSource", false);
            elements2.forEach(addinqueue);
        }
    };
};
