"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:variable-name */
const node_opcua_factory_1 = require("node-opcua-factory");
exports.SampleDerived_Schema = {
    name: "SampleDerived",
    baseType: "SampleBase",
    documentation: "A FOOBAR Derived Object.",
    id: node_opcua_factory_1.next_available_id(),
    fields: [{ name: "otherName", fieldType: "String", documentation: "The name." }]
};
//# sourceMappingURL=SampleDerived_schema.js.map
