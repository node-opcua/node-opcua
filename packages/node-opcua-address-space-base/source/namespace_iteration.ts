/**
 * Reading what a namespace contains.
 *
 * A namespace has always been able to enumerate its own nodes - documentation generators,
 * schema dumpers and model exporters all need it - but the methods carried a leading
 * underscore and were absent from the published type, so every caller reached them through
 * a cast to a hand-written interface. Three such copies existed in this repository alone,
 * and each one had to be kept in step with an implementation it could not see.
 *
 * They are published here under their plain names. The underscore-prefixed spellings still
 * work and are deprecated.
 */
import type { BaseNode } from "./base_node.js";
import type { UADataType } from "./ua_data_type.js";
import type { UAObjectType } from "./ua_object_type.js";
import type { UAReferenceType } from "./ua_reference_type.js";
import type { UAVariableType } from "./ua_variable_type.js";

/**
 * Enumerating the nodes a namespace holds.
 *
 * The iterators walk the namespace's own index, so they yield only nodes belonging to this
 * namespace, in insertion order, and they do not follow references into any other. A count
 * is a plain size lookup rather than a walk, so preferring it to `[...iterator()].length`
 * is worth doing on a large model.
 *
 * None of these iterators tolerate the namespace being modified while one is open, for the
 * same reason a Map iterator does not: adding or removing a node invalidates it. Collect
 * into an array first when the loop body adds nodes.
 */
export interface INamespaceIterable {
    /** every node in this namespace, whatever its node class */
    nodeIterator(): IterableIterator<BaseNode>;

    /** the object types defined in this namespace */
    objectTypeIterator(): IterableIterator<UAObjectType>;
    /** how many object types this namespace defines */
    objectTypeCount(): number;

    /** the variable types defined in this namespace */
    variableTypeIterator(): IterableIterator<UAVariableType>;
    /** how many variable types this namespace defines */
    variableTypeCount(): number;

    /** the data types defined in this namespace */
    dataTypeIterator(): IterableIterator<UADataType>;
    /** how many data types this namespace defines */
    dataTypeCount(): number;

    /** the reference types defined in this namespace */
    referenceTypeIterator(): IterableIterator<UAReferenceType>;
    /** how many reference types this namespace defines */
    referenceTypeCount(): number;

    /** how many aliases this namespace declares */
    aliasCount(): number;

    /** @deprecated use {@link INamespaceIterable.objectTypeIterator} */
    _objectTypeIterator(): IterableIterator<UAObjectType>;
    /** @deprecated use {@link INamespaceIterable.objectTypeCount} */
    _objectTypeCount(): number;
    /** @deprecated use {@link INamespaceIterable.variableTypeIterator} */
    _variableTypeIterator(): IterableIterator<UAVariableType>;
    /** @deprecated use {@link INamespaceIterable.variableTypeCount} */
    _variableTypeCount(): number;
    /** @deprecated use {@link INamespaceIterable.dataTypeIterator} */
    _dataTypeIterator(): IterableIterator<UADataType>;
    /** @deprecated use {@link INamespaceIterable.dataTypeCount} */
    _dataTypeCount(): number;
    /** @deprecated use {@link INamespaceIterable.referenceTypeIterator} */
    _referenceTypeIterator(): IterableIterator<UAReferenceType>;
    /** @deprecated use {@link INamespaceIterable.referenceTypeCount} */
    _referenceTypeCount(): number;
    /** @deprecated use {@link INamespaceIterable.aliasCount} */
    _aliasCount(): number;
}
