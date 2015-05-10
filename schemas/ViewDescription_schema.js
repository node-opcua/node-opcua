"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// see part 4 $7.37
var ViewDescription_Schema = {
    name: "ViewDescription",
    documentation: 'the view to browse.',
    fields: [
        // ViewDescription : NodeId of the View to Query. A null value indicates the entire AddressSpace.
        {name: "viewId", fieldType: "NodeId", documentation: "The node id of the view."},
        // The time date desired. The corresponding version is the one with the closest
        // previous creation timestamp. Either the Timestamp or the viewVersion
        // parameter may be set by a Client, but not both. If ViewVersion is set this
        // parameter shall be null.
        {name: "timestamp", fieldType: "UtcTime", documentation: "Browses the view at or before this time."},
        //
        // The version number for the View desired. When Nodes are added to or removed from a View, the value of a
        // View‟s ViewVersion Property is updated. Either the Timestamp or the viewVersion parameter may be set by
        // a Client, but not both.
        // The ViewVersion Property is defined in Part 3. If timestamp is set this parameter
        // shall be 0. The current view is used if timestamp is null and viewVersion is 0.
        { name: "viewVersion", fieldType: "UInt32", documentation: "Browses a specific version of the view ."}
    ]
};

exports.ViewDescription_Schema = ViewDescription_Schema;

