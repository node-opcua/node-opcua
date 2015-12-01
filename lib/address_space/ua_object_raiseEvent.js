"use strict";
var assert = require("better-assert");

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
        eventType = addressSpace.findEventType(eventType);

        // istanbul ignore next
        if (!eventType) {
            throw new Error("Cannot find event " + eventType.toString());
        }
        //xx assert(eventType.isAbstract);
        //xx eventType.instantiate({browseName: "###"},data);

        var eventData = addressSpace.constructEventData(eventType,data);



        var queue = [];
        // all events are notified to the server object
        // emit on server object
        var server = addressSpace.findObject("Server");
        server.emit("event",eventData);

        // walk up the hasNotify / hasEventSource chain
        var m = {};
        m[server.nodeId.toString()] = server;

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
