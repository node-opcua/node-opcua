import type { NodeId } from "node-opcua-nodeid";
import type { ExtensionObjectBuilder, ExtensionObjectConstructorFuncWithSchema } from "../source/index.js";

export const fakeBuilder: ExtensionObjectBuilder = {
    getExtensionObjectConstructor(_dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
        return null as unknown as ExtensionObjectConstructorFuncWithSchema; // This is a fake builder, so we return null
    }
};
