/**
 * @module node-opcua-address-space
 */
import type { IAddressSpace } from "node-opcua-address-space-base";
import { AddressSpaceImpl } from "../impl/address_space.js";
import type { IHistorizerFactory } from "./address_space_ts.js";
import type { Namespace } from "./namespace.js";
import type { UARootFolder } from "./ua_root_folder.js";

/**
 * The address space: the set of nodes a server exposes, and the namespaces they live in.
 *
 * Obtain one with {@link AddressSpace.create}. This is the published shape of it; the class
 * behind it carries a great deal more, none of which is API.
 */
export interface AddressSpace extends IAddressSpace {
    getOwnNamespace(): Namespace;
    registerNamespace(namespaceUri: string): Namespace;
    rootFolder: UARootFolder;
}

/**
 * The static side of {@link AddressSpace}.
 *
 * Naming it separately is what keeps the implementation out of the published API: the value
 * exported below is the real class, but it is seen through this, so only `create` and
 * `historizerFactory` are reachable.
 */
export interface AddressSpaceConstructor {
    /** build an empty address space */
    create(): AddressSpace;

    /**
     * How historized variables get their historian. Assigning here replaces the default that
     * the historical-access code installs on first use.
     */
    historizerFactory?: IHistorizerFactory;
}

/**
 * An interface and a variable may share a name, so `AddressSpace` is both the type you
 * annotate with and the value you call `create()` on, while the implementation class stays
 * unexported and undocumented.
 *
 * This was a conversion for a while, and it no longer needs to be: the compiler now agrees
 * that AddressSpaceImpl provides the published shape. It could not before, because
 * `getOwnNamespace()` returned a `NamespacePrivate` that extended `INamespace` rather than
 * the published `Namespace`, hiding the alarm-and-condition, data-access and machine-state
 * methods NamespaceImpl really has; and correcting that ran into the data-access classes not
 * statically satisfying their own `Ex` interfaces. Both are fixed, so the annotation is
 * checked rather than asserted.
 */
export const AddressSpace: AddressSpaceConstructor = AddressSpaceImpl;
