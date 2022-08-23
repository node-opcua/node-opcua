/**
 * @module node-opcua-service-filter
 */
import { DataType } from "node-opcua-basic-types";
import { ObjectTypeIds } from "node-opcua-constants";
import { AttributeIds, coerceQualifiedName, QualifiedName, stringToQualifiedName } from "node-opcua-data-model";
import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { ContentFilterElementResult } from "node-opcua-types";
import { Variant } from "node-opcua-variant";

import {
    AttributeOperand,
    ContentFilter,
    ContentFilterElement,
    ContentFilterElementOptions,
    ContentFilterOptions,
    ElementOperand,
    EventFilter,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand
} from "./imports";

export function ofType(nodeId: NodeIdLike): ContentFilterElement {
    const element: ContentFilterElement = new ContentFilterElement({
        filterOperator: FilterOperator.OfType,
        filterOperands: [
            new LiteralOperand({
                value: {
                    dataType: DataType.NodeId,
                    value: resolveNodeId(nodeId)
                }
            })
        ]
    });
    return element;
}

export function l(dataType: DataType, value: any): LiteralOperand {
    switch (dataType) {
        case DataType.NodeId:
            value = resolveNodeId(value);
    }

    return new LiteralOperand({ value: new Variant({ dataType, value }) });
}
export function n(n: NodeIdLike): LiteralOperand {
    return l(DataType.NodeId, n);
}

export function s(attributeId: AttributeIds, path: string): SimpleAttributeOperand {
    return new SimpleAttributeOperand({
        attributeId: attributeId,
        browsePath: path.split(".").map(coerceQualifiedName)
    });
}

type A = LiteralOperand | SimpleAttributeOperand | AttributeOperand | ContentFilterElement;

export function or(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.Or
    });
}
export function and(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.And
    });
}
export function lessThan(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.LessThan
    });
}
export function LessThanOrEqual(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.LessThanOrEqual
    });
}

export function greaterThanOrEqual(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.GreaterThanOrEqual
    });
}

export function greaterThan(a: A, b: A): ContentFilterElement {
    return new ContentFilterElement({
        filterOperands: [a, b],
        filterOperator: FilterOperator.GreaterThan
    });
}

export function inList(a: A, l: A[]) {
    return new ContentFilterElement({
        filterOperands: [a, ...l],
        filterOperator: FilterOperator.InList
    });
}

export function makeContentFilterElements(o: ContentFilterElement): ContentFilterElement[] {
    const elements: ContentFilterElement[] = [];

    function pushElement(element: ContentFilterElement) {
        elements.push(element);
        const thisIndex = elements.length - 1;
        if (element.filterOperands) {
            for (let i = 0; i < element.filterOperands.length; i++) {
                const op = element.filterOperands[i];
                if (op instanceof ContentFilterElement) {
                    const index = pushElement(op);
                    element.filterOperands![i] = new ElementOperand({ index });
                }
            }
        }
        return thisIndex;
    }
    pushElement(o);

    return elements;
}

export function makeContentFilter(o: ContentFilterElementOptions): ContentFilter {
    return new ContentFilter({
        elements: makeContentFilterElements(o instanceof ContentFilterElement ? o : new ContentFilterElement(o))
    });
}
