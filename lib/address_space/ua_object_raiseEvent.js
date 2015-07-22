"use strict";
var assert = require("better-assert");

exports.install = function (UAObject) {

    /**
     * @method raiseEvent
     * @param event
     * @param data
     */
    UAObject.prototype.raiseEvent = function (eventType, data) {

        var self = this;
        var address_space = self.__address_space;

        // coerce EventType
        eventType = address_space.findEventType(eventType);

        // istanbul ignore next
        if (!eventType) {
            throw new Error("Cannot find event " + eventType.toString());
        }
        assert(eventType.isAbstract);
        //xx eventType.instantiate({browseName: "###"},data);
        self.emit("event", data);
    };

};
