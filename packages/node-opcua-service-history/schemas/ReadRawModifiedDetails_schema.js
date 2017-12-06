var ReadRawModifiedDetails_Schema = {
    name: "ReadRawModifiedDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "isReadModified", fieldType: "Boolean"  },
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "numValuesPerNode", fieldType: "UInt32"   },
        { name: "returnBounds", fieldType: "Boolean"  }
    ]
};
exports.ReadRawModifiedDetails_Schema = ReadRawModifiedDetails_Schema;