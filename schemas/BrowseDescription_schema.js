"use strict";
require("requirish")._(module);

var BrowseDirection = require("schemas/BrowseDirection_enum").BrowseDirection;
var NodeClass = require("schemas/NodeClass_enum").NodeClass;

var ResultMask = require("schemas/ResultMask_enum").ResultMask;

var BrowseDescription_Schema = {
    name: "BrowseDescription",
    documentation: 'A request to browse the the references from a node.',
    fields: [
        {name: "nodeId", fieldType: "NodeId", documentation: "The id of the node to browse."},
        {name: "browseDirection", fieldType: "BrowseDirection", documentation: "The direction of the references to return."},
        {name: "referenceTypeId", fieldType: "NodeId",
            documentation: "The type of references to return." +
            "Specifies the NodeId of the ReferenceType to follow. Only instances of this ReferenceType or its subtype are returned." +
            "If not specified then all ReferenceTypes are returned and includeSubtypes is ignored."
        },
        {name: "includeSubtypes", fieldType: "Boolean", documentation: "Includes subtypes of the reference type."},

        // mask :
        //  bit
        //   0   Object
        //   1   Variable
        //   2   Method
        //   3   ObjectType
        //   4   VariableType
        //   5   ReferenceType
        //   6   DataType
        //   7   View
        {name: "nodeClassMask", fieldType: "UInt32", documentation: "A mask indicating which node classes to return. 0 means return all nodes."},

        // mask : (see ResultMask)
        //  bit
        //   0   ReferenceType
        //   1   IsForward
        //   2   NodeClass
        //   3   BrowseName
        //   4   DisplayName
        //   5   TypeDefinition
        {name: "resultMask", fieldType: "UInt32", defaultValue: 0, documentation: "A mask indicating which fields in the ReferenceDescription should be returned in the results."}
    ]
};
exports.BrowseDescription_Schema = BrowseDescription_Schema;