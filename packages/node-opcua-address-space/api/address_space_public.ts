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
 * The conversion is here, in one place, and it is doing something specific: AddressSpaceImpl
 * types `getOwnNamespace()` as `NamespacePrivate`, which extends `INamespace` rather than the
 * published `Namespace`, so the compiler cannot see the alarm-and-condition, data-access and
 * machine-state methods that NamespaceImpl really has and that this package has always
 * documented. The published shape above is the accurate one; the implementation's internal
 * types are the ones that under-declare, and correcting them runs into the data-access
 * classes not statically satisfying their own `Ex` interfaces (they carry
 * `this as unknown as UAMultiStateDiscreteEx<T, DT>` for the same reason). That is tracked
 * separately. Until it is done, this line is where the two views meet - previously they never
 * met at all, because each was a class of its own.
 */
export const AddressSpace = AddressSpaceImpl as unknown as AddressSpaceConstructor;
