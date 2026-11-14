/**
 * @module node-opcua-server
 */
import { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId } from "node-opcua-nodeid";
export type EngineForFactory = object;
export declare class Factory {
    engine: EngineForFactory;
    constructor(engine: EngineForFactory);
    constructObject(id: ExpandedNodeId): ExtensionObject;
}
//# sourceMappingURL=factory.d.ts.map