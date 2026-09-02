/**
 * @module node-opcua-address-space
 *
 * Bumped each time a ReferenceType node is created, in any namespace. Every cache derived from
 * the reference-type hierarchy (the subtype index of a reference type, the memoized result of
 * `findReferencesEx`) records the value it was built with and rebuilds when it moved, since a
 * reference type loaded later may be a subtype of one that was already indexed.
 *
 * A module of its own so that BaseNodeImpl and UAReferenceTypeImpl can both read it without
 * importing each other at module-evaluation time.
 */
export const referenceTypeVersion = { count: 0 };
