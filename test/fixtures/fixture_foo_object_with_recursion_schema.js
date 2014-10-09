var factories = require("../../lib/misc/factories");


var FooWithRecursion_Schema = {
    name: "FooWithRecursion",
    documentation: 'A dummy Object.',
    id: factories.next_available_id(),

    fields: [
        { name: "name"  , fieldType: "String"           },
        { name: "inner" , fieldType: "FooWithRecursion" }
    ]
};
exports.FooWithRecursion_Schema =FooWithRecursion_Schema;
exports.FooWithRecursion = factories.registerObject(FooWithRecursion_Schema,"tmp");
