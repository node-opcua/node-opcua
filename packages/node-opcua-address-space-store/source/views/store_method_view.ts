/**
 * @module node-opcua-address-space-store
 *
 * A Method over a node index: the function the application binds to it, and the arguments its
 * InputArguments and OutputArguments properties declare. A Method of the store is executable
 * once something is bound to it.
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { Argument, CallMethodResultOptions } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { StoreAddressSpace } from "./store_address_space.js";
import { StoreNodeView } from "./store_node_view.js";

/**
 * what runs when a client calls the Method: the input arguments as checked against its
 * InputArguments, the session's context (null for the application itself), the Object it is
 * called on. What it returns is the result of the call; a statusCode of Good when it has none.
 */
export type StoreMethodHandler = (
    inputArguments: Variant[],
    context: ISessionContext | null,
    objectId: NodeId
) => Promise<CallMethodResultOptions> | CallMethodResultOptions;

export class StoreMethodView extends StoreNodeView {
    constructor(space: StoreAddressSpace, index: number) {
        super(space, index);
    }

    /** what runs when the Method is called: the Method becomes executable */
    public bindMethod(handler: StoreMethodHandler): void {
        this.space.methods.set(this.index, handler);
        this.space.store.nodes.setBound(this.index, true);
    }

    public get isBound(): boolean {
        return this.space.methods.has(this.index);
    }

    /** the arguments its InputArguments property declares; null when it has none the store can read */
    public get inputArguments(): Argument[] | null {
        return this.#arguments("InputArguments");
    }

    public get outputArguments(): Argument[] | null {
        return this.#arguments("OutputArguments");
    }

    #arguments(name: string): Argument[] | null {
        const property = this.getChildByName(name, 0);
        if (!property) return null;
        const stored = this.space.store.values.get(property.index).value as { value?: unknown } | undefined;
        const value = stored?.value;
        return Array.isArray(value) ? (value as Argument[]) : null;
    }
}
