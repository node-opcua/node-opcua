

var MonitoredItemNotification_Schema = {
    name: "MonitoredItemNotification",
    fields: [
        { name: "clientHandle", fieldType: "IntegerId" ,documentation:"Client-supplied handle for the MonitoredItem. "},

        // If not every detected change has been returned since the Server's queue
        // buffer for the MonitoredItem reached its limit and had to purge out data and
        // the size of the queue is larger than one, the Overflow bit in the DataValue
        // InfoBits of the statusCode is set.
        { name: "value", fieldType: "DataValue",documentation:"The StatusCode, value and timestamp(s) of the monitored Attribute depending on the sampling and queuing configuration."}
    ]
};

exports.MonitoredItemNotification_Schema = MonitoredItemNotification_Schema;

