/**
 * @module node-opcua-address-space
 */
import type { IHistorizerFactory } from "../source/address_space_ts.js";

/**
 * Where the historian factory actually lives.
 *
 * `AddressSpace.historizerFactory` is the public name for it, and reads and writes there
 * land here. It is held in a module of its own rather than as a static on AddressSpaceImpl
 * because the historical-access code both installs the default and reads it back: reaching
 * for the class would mean importing AddressSpaceImpl from a module AddressSpaceImpl itself
 * imports, and a cycle to hold one mutable field is not a trade worth making.
 *
 * @internal
 */
export const historizerFactoryHolder: { factory?: IHistorizerFactory } = {};
