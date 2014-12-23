
var factories = require("./../lib/misc/factories");

var ViewDescription_Schema = {
    name: "ViewDescription",
    documentation: 'the view to browse.',
    fields: [
        {name: "viewId", fieldType: "NodeId", documentation: "The node id of the view."},
        {name: "timestamp", fieldType: "UtcTime", documentation: "Browses the view at or before this time."},
        {name: "viewVersion", fieldType: "UInt32", documentation: "Browses a specific version of the view ."}
    ]
};

exports.ViewDescription_Schema = ViewDescription_Schema;

