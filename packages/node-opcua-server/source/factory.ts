/**
 * @module node-opcua-server
 */

import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";
import { getStandardDataTypeFactory } from "node-opcua-factory";
import type { ExpandedNodeId } from "node-opcua-nodeid";

// "any non-nullish object" - Factory only stores the engine reference, it never accesses any
// property on it (see the assert below)
export type EngineForFactory = object;
export class Factory {
    public engine: EngineForFactory;

    constructor(engine: EngineForFactory) {
        assert(engine !== null && typeof engine === "object");
        this.engine = engine;
    }

    public constructObject(id: ExpandedNodeId): ExtensionObject {
        const obj = getStandardDataTypeFactory().constructObject(id);
        if (!(obj instanceof ExtensionObject)) {
            throw new Error("Internal Error constructObject");
        }
        return obj as ExtensionObject;
    }
}
