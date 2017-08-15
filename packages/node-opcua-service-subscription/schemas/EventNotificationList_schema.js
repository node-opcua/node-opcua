var EventNotificationList_Schema = {
    name: "EventNotificationList",
    fields: [
        {
            name: "events",
            fieldType: "EventFieldList",
            isArray: true,
            documentation: "The list of Events being delivered. This structure is defined in-line with the following indented items."
        }
    ]
};
exports.EventNotificationList_Schema = EventNotificationList_Schema;