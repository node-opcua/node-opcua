/**
 * The whole-document form of Annex I, flattened into the sequence I.4 writes.
 *
 * `.json` and `.jsonl` are the same nodes in two shapes. The document nests a Node's children
 * inside it and partitions the roots into eight arrays by NodeClass; the line form drops both and
 * relies on `ParentId` and `NodeClass` to say what the shape used to. So a reader of the document
 * form only has to undo the shape, and can then hand the nodes to the same codec.
 *
 * The order is normative, not incidental: I.2 exists so that a decoder reading forwards never
 * meets a NodeId it has not already seen.
 */

import { ANNEX_I_CHILD_ORDER, ANNEX_I_CONTAINER_ORDER, type AnnexINode, type AnnexIUANodeSet } from "./annex_i_types.js";

/**
 * every Node of the document, in reading order: the eight containers in the order the schema
 * defines them, and a Node's own children depth first, before its next sibling.
 */
export function* flattenAnnexIDocument(nodeSet: AnnexIUANodeSet): Generator<AnnexINode> {
    for (const container of ANNEX_I_CONTAINER_ORDER) {
        for (const node of nodeSet.Nodes?.[container] ?? []) {
            yield* flattenNode(node, undefined);
        }
    }
}

/**
 * one Node and its descendants, with `Children` removed and `ParentId` supplied.
 *
 * The schema says `ParentId` is "ignored when the Node is in a ChildList, where the owner is
 * always the containing Node", so a document is free to leave it out. Flattening is what takes
 * the nesting away, and I.4 requires every Node that was in a ChildList to state it, so this
 * fills in what the nesting was saying.
 */
function* flattenNode(node: AnnexINode, parentId: string | undefined): Generator<AnnexINode> {
    const { Children, ...rest } = node;
    if (parentId !== undefined && rest.ParentId === undefined) {
        rest.ParentId = parentId;
    }
    yield rest;
    if (!Children) {
        return;
    }
    for (const kind of ANNEX_I_CHILD_ORDER) {
        for (const child of Children[kind] ?? []) {
            yield* flattenNode(child, node.NodeId);
        }
    }
}
