/* tslint:disable:variable-name */
import { registerEnumeration, StructuredTypeOptions } from "node-opcua-factory";

export enum Color {
    RED = 100,
    BLUE = 200,
    GREEN = 300
}
const schema_EnumColor = registerEnumeration({
    enumValues: Color,
    name: "EnumColor"
});

export const schema_Shape: StructuredTypeOptions = {
    baseType: "",
    name: "Shape",
    fields: [
        {
            defaultValue: () => "my shape",
            fieldType: "String",
            name: "name"
        },
        {
            fieldType: "EnumShapeType",
            name: "shapeType"
        },
        {
            defaultValue: Color.GREEN,
            fieldType: "EnumColor",
            name: "color"
        },
        {
            defaultValue: () => Color.BLUE,
            fieldType: "EnumColor",
            name: "inner_color"
        }
    ]
};
