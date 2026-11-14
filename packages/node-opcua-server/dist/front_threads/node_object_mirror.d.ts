/**
 * @module node-opcua-server
 *
 * The live values of the engine's node objects (namespace 0: ServerStatus, ServiceLevel, the
 * capabilities, the diagnostics) kept in the shared store, where the fronts and the session
 * workers read every value: in place for a value the store holds, through the engine for a value
 * a getter computes. A Variable whose node object holds its value has it copied into the store,
 * then again at each change; one whose node object computes it (a getter) gets a getter in the
 * store that reads the node object, so that a reader of another thread asks the engine for it.
 */
import type { CompactAddressSpace, IAddressSpace } from "node-opcua-address-space";
/**
 * keeps the store in step with the node objects of these namespaces; returns how many Variables
 * it mirrors and what stops it
 */
export declare function mirrorNodeObjects(addressSpace: IAddressSpace, compact: CompactAddressSpace, namespaces: number[]): {
    mirrored: number;
    stop: () => void;
};
//# sourceMappingURL=node_object_mirror.d.ts.map