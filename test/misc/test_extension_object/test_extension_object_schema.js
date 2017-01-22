import {
  next_available_id
} from "lib/misc/factories";

exports.MetaShapeForUnitTest_Schema = {
    name: "MetaShapeForUnitTest",
    id: next_available_id(),
    fields: [
        {name: "name", fieldType: "String"},
        {name: "shape", fieldType: "ExtensionObject"},
        {name: "comment", fieldType: "String"}
    ]
};



var Potato_Schema_Id = 0xF00001;
exports.Potato_Schema = {
    name: "Potato",
    id: Potato_Schema_Id,
    fields: [
        {name: "length", fieldType: "Double"},
        {name: "radius", fieldType: "Double"}

    ]
};
