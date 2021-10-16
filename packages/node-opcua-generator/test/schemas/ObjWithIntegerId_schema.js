"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:variable-name */
const node_opcua_factory_1 = require("node-opcua-factory");
exports.ObjWithIntegerId_Schema = {
    id: node_opcua_factory_1.next_available_id(),
    name: "ObjWithIntegerId",
    fields: [
        { name: "title", fieldType: "UAString" },
        {
            name: "requestHandle",
            fieldType: "IntegerId"
        }
    ]
};
//# sourceMappingURL=ObjWithIntegerId_schema.js.map
