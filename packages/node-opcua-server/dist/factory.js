/**
 * @module node-opcua-server
 */
import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";
import { getStandardDataTypeFactory } from "node-opcua-factory";
export class Factory {
    engine;
    constructor(engine) {
        assert(engine !== null && typeof engine === "object");
        this.engine = engine;
    }
    constructObject(id) {
        const obj = getStandardDataTypeFactory().constructObject(id);
        if (!(obj instanceof ExtensionObject)) {
            throw new Error("Internal Error constructObject");
        }
        return obj;
    }
}
//# sourceMappingURL=factory.js.map