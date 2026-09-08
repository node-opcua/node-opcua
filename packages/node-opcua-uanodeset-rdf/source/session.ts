/**
 * The session entry point: `node-opcua-uanodeset-rdf/session`.
 *
 * Nothing reachable from here mentions `node-opcua-address-space`, at the type level or the
 * runtime one, so a client application can export a server's model without loading the address
 * space machinery it has no other use for. That is the whole reason this is a separate entry
 * point rather than a second function in the root one.
 *
 * What a session cannot tell you is listed in `VOCABULARY.md`; the short version is that OPC UA
 * has no service listing the nodes of a namespace, `SymbolicName` is not an attribute, and
 * `NamespaceMetadataType` states no required models.
 */

import { type RdfSession, sessionToRdfModel } from "./from_session.js";
import { type JsonLdOptions, modelToJsonLd } from "./to_jsonld.js";

export { type RdfSession, sessionToRdfModel } from "./from_session.js";
export type { RdfModel, RdfModelReference, RdfNode, RdfReference, RdfTarget } from "./model.js";
export { type JsonLdOptions, modelToJsonLd, OPCUA_NAMESPACE, prefixOfNamespace, UARDF } from "./to_jsonld.js";

/**
 * a namespace of a server as a JSON-LD document.
 *
 * The session may be a real client session, or a `PseudoSession` over an address space. The
 * latter is what makes the two paths comparable: the same model collected two ways, where the
 * difference is exactly what a session cannot carry.
 */
export async function sessionToJsonLd(session: RdfSession, options: JsonLdOptions = {}): Promise<Record<string, unknown>> {
    return modelToJsonLd(await sessionToRdfModel(session, options.modelUri), options);
}

/** a namespace of a server as a JSON-LD document, serialised */
export async function sessionToJsonLdText(session: RdfSession, options: JsonLdOptions = {}): Promise<string> {
    return `${JSON.stringify(await sessionToJsonLd(session, options), null, 2)}\n`;
}
