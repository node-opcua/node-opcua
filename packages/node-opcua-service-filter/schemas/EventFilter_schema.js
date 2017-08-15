
var EventFilter_Schema = {
    name: "EventFilter",
    baseType: "MonitoringFilter",
    fields: [
        { name: "selectClauses", isArray: true, fieldType: "SimpleAttributeOperand" },
        { name: "whereClause",   fieldType: "ContentFilter", dataType: "i=583" }
    ]
};
exports.EventFilter_Schema = EventFilter_Schema;