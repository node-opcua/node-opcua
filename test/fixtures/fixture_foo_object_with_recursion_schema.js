
import {
  next_available_id
} from "lib/misc/factories";


var FooWithRecursion_Schema = {
    name: "FooWithRecursion",
    documentation: 'A dummy Object.',
    id: next_available_id(),

    fields: [
        {name: "name", fieldType: "String"},
        {name: "inner", fieldType: "FooWithRecursion"}
    ]
};
exports.FooWithRecursion_Schema = FooWithRecursion_Schema;
