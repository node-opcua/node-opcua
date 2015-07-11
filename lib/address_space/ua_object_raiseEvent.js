

exports.install = function(UAObject) {

    /**
     * @method raiseEvent
     * @param event
     * @param data
     */
    UAObject.prototype.raiseEvent = function(eventType,data) {

        var self = this;
        var address_space = self.__address_space;

        // coerce EventType
        eventType =  address_space.findEventType(eventType);

        eventType.instantiate({browseName: "###"},data);
        console.log( "emmiting");
        self.emit("event",data);
    };

};