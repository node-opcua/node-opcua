"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:variable-name */
const node_opcua_factory_1 = require("node-opcua-factory");
var Color;
(function (Color) {
    Color[Color["RED"] = 100] = "RED";
    Color[Color["BLUE"] = 200] = "BLUE";
    Color[Color["GREEN"] = 300] = "GREEN";
})(Color = exports.Color || (exports.Color = {}));
const schema_EnumColor = node_opcua_factory_1.registerEnumeration({
    name: "EnumColor",
    enumValues: Color
});
exports.schema_Shape = {
    name: "Shape",
    fields: [
        {
            name: "name", fieldType: "String", defaultValue: () => "my shape"
        },
        {
            name: "shapeType", fieldType: "EnumShapeType"
        },
        {
            name: "color", fieldType: "EnumColor", defaultValue: Color.GREEN
        },
        {
            name: "inner_color", fieldType: "EnumColor", defaultValue: () => Color.BLUE
        }
    ]
};
//# sourceMappingURL=Shape_schema.js.map