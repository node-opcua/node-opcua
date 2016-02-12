"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var DataType = require("lib/datamodel/variant").DataType;

exports.install = function (UAObject) {

    /**
     * @method raiseEvent
     * @param eventType
     * @param data
     */
    UAObject.prototype.raiseEvent = function (eventType, data) {

        assert(eventType);

        var self = this;
        var addressSpace = self.__address_space;

        // coerce EventType
        var eventTypeNode = addressSpace.findEventType(eventType);

        // istanbul ignore next
        if (!eventTypeNode) {
            throw new Error("Cannot find event type :" + eventType.toString());
        }
        //xx assert(eventType.isAbstract);
        //xx eventType.instantiate({browseName: "###"},data);

        var baseEventType = addressSpace.findEventType("BaseEventType");
        assert(eventTypeNode.isSupertypeOf(baseEventType));

        data.$eventType = eventTypeNode;

        data.sourceNode = data.sourceNode || { dataType: DataType.NodeId, value: self.nodeId };

        var eventData = addressSpace.constructEventData(eventTypeNode,data);

        var queue = [];
        // walk up the hasNotify / hasEventSource chain
        var m = {};

        // all events are notified to the server object
        // emit on server object
        var server = addressSpace.findNode("Server");

        if (server) {
            server.emit("event",eventData);
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
