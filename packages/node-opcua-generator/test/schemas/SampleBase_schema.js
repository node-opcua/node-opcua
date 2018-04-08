
const factories = require("node-opcua-factory");

const SampleBase_Schema = {
    name: "SampleBase",
    documentation: "A FOOBAR Object.",

    id: factories.next_available_id(),
    fields: [
        {name: "name", fieldType: "String", documentation: "The name."}
    ]
};
exports.SampleBase_Schema = SampleBase_Schema;
