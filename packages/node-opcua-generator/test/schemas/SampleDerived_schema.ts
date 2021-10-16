/* tslint:disable:variable-name */
import { next_available_id } from "node-opcua-factory";
export const SampleDerived_Schema = {
    name: "SampleDerived",
    baseType: "SampleBase",
    documentation: "A FOOBAR Derived Object.",

    id: next_available_id(),
    fields: [{ name: "otherName", fieldType: "String", documentation: "The name." }]
};
