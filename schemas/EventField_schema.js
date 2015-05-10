"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var EventField_Schema = {
    id: factories.next_available_id(),
    name:"EventField",
    fields: [
        {name:"clientHandle",fieldType:"IntegerId",documentation:"Client-supplied handle for the MonitoredItem"},
        {name:"eventFields", fieldType:"Variant", isArray: true, documentation:"List of selected Event fields. This shall be a one to one match with the fields selected in the EventFilter."}
    ]
};
exports.EventField_Schema = EventField_Schema;