// <   BaseType="ua:">
var ReadEventDetails_Schema = {
    name: "ReadEventDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "numValuesPerNode", fieldType: "UInt32"   },
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "filter", fieldType: "EventFilter" }
    ]
};
exports.ReadEventDetails_Schema = ReadEventDetails_Schema;