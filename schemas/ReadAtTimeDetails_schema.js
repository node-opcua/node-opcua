const ReadAtTimeDetails_Schema = {
    name: "ReadAtTimeDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "reqTimes", isArray: true, fieldType: "DateTime" },
        { name: "useSimpleBounds", fieldType: "Boolean" }
    ]
};
export {ReadAtTimeDetails_Schema};