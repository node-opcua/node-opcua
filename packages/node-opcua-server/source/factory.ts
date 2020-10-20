/**
 * @module node-opcua-server
 */

import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";
import { constructObject } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";

export class Factory {
    public engine: any;

    constructor(engine: any) {
        assert(engine !== null && typeof engine === "object");
        this.engine = engine;
    }

    public constructObject(id: ExpandedNodeId): ExtensionObject {
        const obj = constructObject(id);
        if (!(obj instanceof ExtensionObject)) {
            throw new Error("Internal Error constructObject");
        }
        return obj as ExtensionObject;
    }
}
