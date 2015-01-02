
var ContentFilter_Schema = {
    name: "ContentFilter",
    fields: [
        // List of operators and their operands that compose the filter criteria. The filter is
        // evaluated by starting with the first entry in this array. This structure is defined
        // in-line with the following indented items.
        { name: "elements", isArray: true,  fieldType:"ContentFilterElement" }
    ]
};
exports.ContentFilter_Schema = ContentFilter_Schema;

