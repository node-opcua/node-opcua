require("requirish")._(module);
var factories = require("lib/misc/factories");

var DataType_Schema = {
    name:"DataType",
    enumValues: {
        Null:              0,
        Boolean:           1,
        SByte:             2, // signed Byte = Int8
        Byte :             3, // unsigned Byte = UInt8
        Int16:             4,
        UInt16:            5,
        Int32:             6,
        UInt32:            7,
        Int64:             8,
        UInt64:            9,
        Float:            10,
        Double:           11,
        String:           12,
        DateTime:         13,
        Guid:             14,
        ByteString:       15,
        XmlElement:       16,
        NodeId:           17,
        ExpandedNodeId:   18,
        StatusCode:       19,
        QualifiedName:    20,
        LocalizedText:    21,
        ExtensionObject:  22,
        DataValue:        23,
        Variant:          24,
        DiagnosticInfo:   25
    }
};

exports.DataType = factories.registerEnumeration(DataType_Schema);
