// <   BaseType="ua:">
const ReadEventDetails_Schema = {
    name: "ReadEventDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "numValuesPerNode", fieldType: "UInt32"   },
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "filter", fieldType: "EventFilter" }
    ]
};
export {ReadEventDetails_Schema};