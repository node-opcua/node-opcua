var factories = require("../lib/misc/factories");

var ExtensibleParameterAdditionalHeader_Schema = {
    name: "ExtensibleParameterAdditionalHeader",
    id: factories.next_available_id(),
    fields: [
        { name: "parameterTypeId", fieldType: "NodeId" },
        { name: "encodingMask", fieldType: "Byte"   }
        // TODO: { name: "data"}
    ]
};
exports.ExtensibleParameterAdditionalHeader_Schema = ExtensibleParameterAdditionalHeader_Schema;