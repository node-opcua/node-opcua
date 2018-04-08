"use strict";

const assert = require("node-opcua-assert").assert;
const DataType = require("node-opcua-variant").DataType;

const NodeId = require("node-opcua-nodeid").NodeId;

exports.install = function (UAObject) {

    const UAObjectType = require("./ua_object_type").UAObjectType;


    /**
     * Raise a transient Event
     * @method raiseEvent
     * @param eventType {String|NodeId|UAObject|UAObjectType} the eventType to find
     * @param data
     */
    UAObject.prototype.raiseEvent = function (eventType, data)
    {

        const self = this;
        const addressSpace = self.addressSpace;

        if (typeof(eventType) === "string") {
            eventType = addressSpace.findEventType(eventType);
        }
        if (eventType instanceof NodeId) {
            eventType = addressSpace.findNode(eventType);
        }
        assert(eventType instanceof UAObjectType);

        let eventTypeNode = eventType;
        // istanbul ignore next
        if (!eventTypeNode) {
            throw new Error("UAObject#raiseEventType : Cannot find event type :" + eventType.toString());
        }

        // coerce EventType
        eventTypeNode = addressSpace.findEventType(eventType);
        const baseEventType = addressSpace.findEventType("BaseEventType");
        assert(eventTypeNode.isSupertypeOf(baseEventType));

        data.$eventDataSource = eventTypeNode;
        data.sourceNode = data.sourceNode || {dataType: DataType.NodeId, value: self.nodeId};

        const eventData = addressSpace.constructEventData(eventTypeNode, data);

        self._bubble_up_event(eventData);
    };

    UAObject.prototype._bubble_up_event = function(eventData)
    {
        const self = this;
        const addressSpace = self.addressSpace;

        const queue = [];
        // walk up the hasNotify / hasEventSource chain
        const m = {};

        // all events are notified to the server object
        // emit on server object
        const server = addressSpace.findNode("Server");

        if (server) {
            assert(server.eventNotifier > 0x00, "Server must be an event notifier");
            server.emit("event", eventData);
            m[server.nodeId.toString()] = server;
        } else {
            console.warn("Warning. ".yellow + "UAObject#raiseEvent".cyan + " cannot find Server object on addressSpace".red);
        }

        addinqueue(self);

        function addinqueue(obj) {
            const key = obj.nodeId.toString();
            if (!m[key]) {
                m[key] = obj;
                queue.push(obj);
            }
        }

        while (queue.length) {
            const obj = queue.pop();
            // emit on object itself
            obj.emit("event", eventData);

            const elements1 = obj.findReferencesAsObject("HasNotifier", false);
            elements1.forEach(addinqueue);

            const elements2 = obj.findReferencesAsObject("HasEventSource", false);
            elements2.forEach(addinqueue);
        }
    };
};
