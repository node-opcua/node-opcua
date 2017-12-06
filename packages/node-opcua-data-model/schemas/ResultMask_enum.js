var BrowseDescriptionResultMask = {

};

"use strict";

var factories = require("node-opcua-factory");

var ResultMask_Schema = {
    name: "ResultMask",
    enumValues: {
        ReferenceType: 0x01,
        IsForward:     0x02,
        NodeClass:     0x04,
        BrowseName:    0x08,
        DisplayName:   0x10,
        TypeDefinition:0x20
    }
};
exports.ResultMask_Schema = ResultMask_Schema;
exports.ResultMask = factories.registerEnumeration(ResultMask_Schema);


