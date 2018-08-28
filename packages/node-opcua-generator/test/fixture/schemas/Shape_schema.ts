/* tslint:disable:variable-name */
import { registerEnumeration, StructuredTypeOptions } from "node-opcua-factory";

export enum Color {
    RED=   100,
    BLUE=  200,
    GREEN= 300,
}
const schema_EnumColor = registerEnumeration({
    name: "EnumColor",
    enumValues: Color
});

export const schema_Shape: StructuredTypeOptions = {
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
