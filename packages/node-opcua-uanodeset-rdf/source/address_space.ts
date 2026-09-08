/**
 * The address-space entry point: `node-opcua-uanodeset-rdf/address-space`.
 *
 * This is the complete source and the one to prefer where the model has been loaded from its
 * NodeSet2 document: an address space retains the metadata OPC UA has no attribute for, so an
 * export taken this way is the reference a session-sourced one is judged against.
 */

import type { IAddressSpace } from "node-opcua-address-space";
import { addressSpaceToRdfModel } from "./from_address_space.js";
import { type JsonLdOptions, modelToJsonLd } from "./to_jsonld.js";

export { addressSpaceToRdfModel } from "./from_address_space.js";
export type { RdfModel, RdfModelReference, RdfNode, RdfReference, RdfTarget } from "./model.js";
export { type JsonLdOptions, modelToJsonLd, OPCUA_NAMESPACE, prefixOfNamespace, UARDF } from "./to_jsonld.js";

/** a namespace of an address space as a JSON-LD document */
export function addressSpaceToJsonLd(addressSpace: IAddressSpace, options: JsonLdOptions = {}): Record<string, unknown> {
    return modelToJsonLd(addressSpaceToRdfModel(addressSpace, options.modelUri), options);
}

/** a namespace of an address space as a JSON-LD document, serialised */
export function addressSpaceToJsonLdText(addressSpace: IAddressSpace, options: JsonLdOptions = {}): string {
    return `${JSON.stringify(addressSpaceToJsonLd(addressSpace, options), null, 2)}\n`;
}
