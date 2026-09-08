/**
 * An OPC UA information model as JSON-LD, for loading into a SPARQL store.
 *
 * The vocabulary belongs to the reference implementation, whose `rdf_prototype.md` no longer
 * describes what it emits, so its output is the specification. `VOCABULARY.md` beside this file
 * records what reading that output established.
 *
 * Collection and mapping are separate: `from_address_space.ts` fills an `RdfModel`, `to_jsonld.ts`
 * maps it. The mapper reads nothing but that structure, which is what lets a second collector be
 * added without touching a line of the vocabulary.
 */

export * from "./address_space.js";
