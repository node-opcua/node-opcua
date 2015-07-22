"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var is_valid_attributeId = require("lib/datamodel/attributeIds").is_valid_attributeId;

require("lib/datamodel/numeric_range");

var ReadValueId_Schema = {
    name: "ReadValueId",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId" ,
            validate:function(value){
                return is_valid_attributeId(value) || value === AttributeIds.INVALID;
            },
            defaultValue: AttributeIds.Value
        }, // see AttributeIds

        // IndexRange : This parameter is used to identify a single element of a structure or an array, or a single
        // range of indexes for arrays. If a range of elements  are specified, the values are returned as a composite.
        // The first element is identified by index 0 (zero).
        // This parameter is null if the specified Attribute is not an array or a structure. However, if the specified
        // Attribute is an array or a structure,and this parameter is null, then all elements are to be included in the
        // range.
        { name: "indexRange",   fieldType: "NumericRange"},

        // dataEncoding
        //
        //    This parameter specifies the BrowseName of the DataTypeEncoding that the
        //    Server should use when returning the Value Attribute of a Variable. It is an error
        //    to specify this parameter for other Attributes.
        //    A Client can discover what DataTypeEncodings are available by following the
        //    HasEncoding Reference from the DataType Node for a Variable.
        //    OPC UA defines BrowseNames which Servers shall recognize even if the
        //    DataType Nodes are not visible in the Server address space. These
        //    BrowseNames are:
        //      - DefaultBinary  The default or native binary (or non-XML) encoding.
        //      - DefaultXML  The default XML encoding.
        //
        //    Each DataType shall support at least one of these encodings. DataTypes that do
        //    not have a true binary encoding (e.g. they only have a non-XML text encoding)
        //    should use the DefaultBinary name to identify the encoding that is considered to
        //    be the default non-XML encoding. DataTypes that support at least one XML-based
        //    encoding shall identify one of the encodings as the DefaultXML encoding.
        //    Other standards bodies may define other well-known data encodings that could
        //    be supported.
        //
        //    If this parameter is not specified then the Server shall choose either the
        //    DefaultBinary or DefaultXML encoding according to what Message encoding
        //    (see Part 6) is used for the Session. If the Server does not support the encoding
        //    that matches the Message encoding then the Server shall choose the default
        //    encoding that it does support.
        //
        //    If this parameter is specified for a MonitoredItem, the Server shall set the
        //    StructureChanged bit in the StatusCode (see 7.33) if the DataTypeEncoding
        //    changes. The DataTypeEncoding changes if the DataTypeVersion of the
        //    DataTypeDescription or the DataTypeDictionary associated with the
        //    DataTypeEncoding changes
        { name: "dataEncoding",  fieldType: "QualifiedName" }
    ]
};
exports.ReadValueId_Schema = ReadValueId_Schema;
