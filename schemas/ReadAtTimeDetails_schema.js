var ReadAtTimeDetails_Schema = {
    name: "ReadAtTimeDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "reqTimes", isArray: true, fieldType: "DateTime" },
        { name: "useSimpleBounds", fieldType: "Boolean" }
    ]
};
exports.ReadAtTimeDetails_Schema = ReadAtTimeDetails_Schema;