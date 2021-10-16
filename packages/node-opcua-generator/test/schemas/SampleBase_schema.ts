/* tslint:disable:variable-name */
import { next_available_id } from "node-opcua-factory";

export const SampleBase_Schema = {
    name: "SampleBase",
    documentation: "A FOOBAR Object.",

    id: next_available_id(),
    fields: [{ name: "name", fieldType: "String", documentation: "The name." }]
};
