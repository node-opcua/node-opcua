require("node-opcua-basic-types");

const { registerEnumeration, next_available_id } = require("node-opcua-factory");

const { registerObject } = require("../..");

function initialize() {
    const SomeEnumeration = registerEnumeration({
        name: "SomeEnumeration",
        enumValues: {
            CIRCLE: 1,
            SQUARE: 2,
            RECTANGLE: 3,
            HEXAGON: 6
        }
    });
    exports.SomeEnumeration = SomeEnumeration;

    // -----------------------------------------------------
    const FooBar_Schema = {
        name: "FooBar",
        documentation: "A FOOBAR Object.",

        id: next_available_id(),
        fields: [{ name: "name", fieldType: "String", documentation: "The name." }]
    };

    const path = require("path");
    const temporary_folder = path.join(__dirname, "../..", "_test_generated");

    exports.FooBar_Schema = FooBar_Schema;
    exports.FooBar = registerObject(FooBar_Schema, temporary_folder);

    const FooBarDerived_Schema = {
        name: "FooBarDerived",
        documentation: "A FOOBAR Derived Object.",
        baseType: "FooBar",
        id: next_available_id(),
        fields: [{ name: "name2", fieldType: "String", documentation: "The second name." }]
    };
    exports.FooBarDerived_Schema = FooBarDerived_Schema;
    exports.FooBarDerived = registerObject(FooBarDerived_Schema, temporary_folder);

    const DummyObject_Schema = {
        name: "DummyObject",
        documentation: "A dummy Object.",

        id: next_available_id(),
        fields: [
            { name: "name", fieldType: "String", documentation: "The name." },
            { name: "viewId", fieldType: "NodeId", documentation: "The node id of the view." },
            { name: "timestamp", fieldType: "UtcTime", documentation: "Browses the view at or before this time." },
            { name: "viewVersion", fieldType: "UInt32", documentation: "Browses a specific version of the view ." },
            { name: "ArrayInt", fieldType: "UInt32", isArray: true, documentation: "an array with Int values." },
            { name: "typeEnum", fieldType: "SomeEnumeration", documentation: "an array with Int values." },
            { name: "fooBar", fieldType: "FooBar", documentation: "a foo bar object" }
        ]
    };

    exports.DummyObject_Schema = DummyObject_Schema;
    exports.DummyObject = registerObject(DummyObject_Schema, temporary_folder);
}
