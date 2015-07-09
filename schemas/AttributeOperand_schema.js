"use strict";
require("requirish")._(module);
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var AttributeOperand_Schema = {
    name:"AttributeOperand",
    baseType:"FilterOperand",
    fields:[
        { name: "nodeId",     fieldType:"NodeId",documentation:"NodeId of a Node from the type system."},
        { name: "alias",      fieldType:"String", documentation:"An optional parameter used to identify or refer to an alias. An alias is a symbolic name that can be used to alias this operand and use it in other locations in the filter structure."},
        { name: "browsePath", fieldType:"RelativePath",documentation:"Browse path relative to the Node identified by the nodeId parameter."},
        { name: "attributeId",fieldType:"IntegerId", documenation:"Id of the Attribute. This shall be a valid AttributeId. "},

        // indexRange:
        // This parameter is used to identify a single element of an array or a single range of indexes for an array.
        // The first element is identified by index 0 (zero).
        // This parameter is not used if the specified Attribute is not an array. However, if
        // the specified Attribute is an array and this parameter is not used, then all
        // elements are to be included in the range. The parameter is null if not used.
        { name: "indexRange", fieldType:"NumericRange",documentation:"This parameter is used to identify a single element of an array or a single range of indexes for an array. The first element is identified by index 0 (zero)."}
    ]
};
exports.AttributeOperand_Schema = AttributeOperand_Schema;


