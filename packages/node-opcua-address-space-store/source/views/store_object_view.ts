/**
 * @module node-opcua-address-space-store
 *
 * An Object over a node index.
 */
import type { StoreAddressSpace } from "./store_address_space.js";
import { StoreNodeView } from "./store_node_view.js";

export class StoreObjectView extends StoreNodeView {
    constructor(space: StoreAddressSpace, index: number) {
        super(space, index);
    }
    public get eventNotifier(): number {
        return this.space.store.nodes.eventNotifier(this.index);
    }
}
