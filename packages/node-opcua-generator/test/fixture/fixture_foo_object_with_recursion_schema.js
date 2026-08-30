const path = require("path");
const factories = require("node-opcua-factory");
const generator = require("../..");
const temporary_folder = path.join(__dirname, "../..", "_test_generated");

function initialize() {
    const FooWithRecursion_Schema = {
        name: "FooWithRecursion",
        documentation: "A dummy Object.",
        id: factories.next_available_id(),

        fields: [
            { name: "name", fieldType: "String" },
            { name: "inner", fieldType: "FooWithRecursion" }
        ]
    };
    exports.FooWithRecursion_Schema = FooWithRecursion_Schema;

    // var foo_reloaded = encode_decode_round_trip_test(foo);

    // make sure we use a fresh copy
    generator.unregisterObject(FooWithRecursion_Schema, temporary_folder);

    exports.FooWithRecursion = generator.registerObject(FooWithRecursion_Schema, temporary_folder);
}
