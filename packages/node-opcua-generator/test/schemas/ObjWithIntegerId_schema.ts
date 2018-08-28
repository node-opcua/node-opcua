/* tslint:disable:variable-name */
import { next_available_id } from "node-opcua-factory";
export const ObjWithIntegerId_Schema = {

    id: next_available_id(),
    name: "ObjWithIntegerId",
    fields: [
        {name: "title", fieldType: "UAString"},
        {
            name: "requestHandle", fieldType: "IntegerId"
        }
    ]
};