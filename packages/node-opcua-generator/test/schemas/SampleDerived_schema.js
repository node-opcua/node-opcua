
var factories = require("node-opcua-factory");

var SampleDerived_Schema = {
    name: "SampleDerived",
    baseType: "SampleBase",
    documentation: "A FOOBAR Derived Object.",

    id: factories.next_available_id(),
    fields: [
        {name: "otherName", fieldType: "String", documentation: "The name."}
    ]
};
exports.SampleDerived_Schema = SampleDerived_Schema;
