/**
 * An OPC UA information model as JSON-LD, for loading into a SPARQL store.
 *
 * This is unlike the Annex I formats in every way that matters, which is why it lives in a
 * package of its own.
 *
 * It is **not in the specification**. OPC 10000-6 Annex I runs I.1 to I.24 and has no RDF
 * section. The vocabulary belongs to the reference implementation, whose `rdf_prototype.md` no
 * longer describes what it emits, so its output is the specification. What we reverse-engineered
 * is written down in `VOCABULARY.md` beside this file.
 *
 * It is **one-way**. There is no reader, so none of the checks that make the Annex I formats
 * trustworthy apply: no round trip, no fixpoint, no digest equivalence. A diff against the
 * reference implementation is the only oracle, which is why matching it exactly matters more here
 * than for a format that can be checked against itself.
 *
 * There are two ways in, and each has an entry point of its own so that neither drags in what
 * only the other needs:
 *
 * - `node-opcua-uanodeset-rdf/address-space` is the complete source, and the one to prefer where
 *   the model was loaded from its NodeSet2 document.
 * - `node-opcua-uanodeset-rdf/session` works against a server whose nodeset file you do not have,
 *   which is the only way to get a vendor's model into a graph store at all. It never mentions
 *   `node-opcua-address-space`, so a client application does not load it.
 *
 * This module is both, for callers that want both.
 */

export * from "./address_space.js";
export { type RdfSession, sessionToRdfModel } from "./from_session.js";
export { sessionToJsonLd, sessionToJsonLdText } from "./session.js";
