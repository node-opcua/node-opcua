"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var EnumNodeClass_Schema = {
    name: "NodeClass",
    documentation: "A mask specifying the class of the node.",
    enumValues: {
        Unspecified:       0,  // No classes are selected.
        Object:            1,  // The node is an object.
        Variable:          2,  // The node is a variable.
        Method :           4,  // The node is a method.
        ObjectType:        8,  // The node is an object type.
        VariableType:     16,  // The node is an variable type.
        ReferenceType:    32,  // The node is a reference type.
        DataType:         64,  // The node is a data type.
        View:            128   // The node is a view.
    }
};
exports.EnumNodeClass_Schema = EnumNodeClass_Schema;
exports.NodeClass = factories.registerEnumeration(EnumNodeClass_Schema);

