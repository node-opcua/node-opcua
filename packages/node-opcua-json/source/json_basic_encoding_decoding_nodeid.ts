/**
 * ==========================================================================
 * Copyright (c) 2021-2026 Sterfive - etienne.rossignon@sterfive.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 * ==========================================================================
 */
import { coerceNodeId, ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid"; // -nodeid";
import type { ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

// from https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4

// NodeId values shall be encoded as a JSON string using the format defined in
// https://reference.opcfoundation.org/Core/Part6/v105/docs/5.1.12#_Ref122651839
// .
//  NodeIds in NamespaceIndex 0 use the <identifier> form.
//  All other NodeIds use the <namespace-uri> form.
//
// The first abnormal state occurs when the encoder cannot map a NamespaceIndex to a NamespaceUri.
// In this case, the encoder shall encode the NamespaceIndex using the <namespace-index > form.
// The decoder shall pass this NamespaceIndex to the application.
//
// The second abnormal state occurs when the decoder cannot convert a NamespaceUri to a NamespaceIndex.
// If this occurs the decoder shall set the NamespaceIndex to 0, the IdType to String and the
// Identifier to the JSON string.
export interface NodeIdJSON104 {
    IdType?: 0 | 1 | 2 | 3;
    Id: number | string;
    Namespace?: number | string;
}
export type NodeIdJSON105 = string;
export type NodeIdJSON = NodeIdJSON104 | NodeIdJSON105;

const nodeIdValueToJson = (value: NodeId): string | number => {
    switch (value.identifierType) {
        case NodeIdType.NUMERIC:
            return value.value as number;
        case NodeIdType.STRING:
            return value.value as string;
        case NodeIdType.GUID:
            return value.value as string;
        case NodeIdType.BYTESTRING:
            return (value.value as Buffer).toString("base64");
        default:
            throw new Error(`Unknown NodeId identifier type: ${value.identifierType}`);
    }
};

const nodeIdValueToString = (value: NodeId): string => {
    switch (value.identifierType) {
        case NodeIdType.NUMERIC:
            return `i=${value.value as number}`;

        case NodeIdType.STRING:
            return `s=${value.value as string}`;

        case NodeIdType.GUID:
            return `g=${value.value as string}`;
        case NodeIdType.BYTESTRING:
            return `b=${(value.value as Buffer).toString("base64")}`;
        default:
            throw new Error(`Unknown NodeId identifier type: ${value.identifierType}`);
    }
};
/**
 *
 * IdType	   The IdentifierType encoded as a JSON number.
 *             Allowed values are:
 *               0 - UInt32 Identifier encoded as a JSON number.
 *               1 - A String Identifier encoded as a JSON string.
 *               2 - A Guid Identifier.
 *               3 - A ByteString Identifier
 *
 *             This field is omitted for UInt32 identifiers.
 *
 *  Id         The Identifier.
 *             The value of the id field specifies the encoding of this field.
 *
 *  Namespace	The NamespaceIndex for the NodeId.
 *              The field is encoded as a JSON number for the reversible encoding.
 *              The field is omitted if the NamespaceIndex equals 0.
 *              For the non-reversible encoding, the field is the NamespaceUri associated with the NamespaceIndex,
 *              encoded as a JSON string.
 *  A NamespaceIndex of 1 is always encoded as a JSON number.
 */

export function opcuaJsonEncodeNodeId104(
    value: NodeId,
    scheme = JsonEncodingScheme.DeprecatedReversible,
    namespaceArray?: string[]
): NodeIdJSON104 {
    const nodeIdIdentifierTypeToJSON = () => {
        switch (value.identifierType) {
            case NodeIdType.NUMERIC:
                return 0;
            case NodeIdType.STRING:
                return 1;
            case NodeIdType.GUID:
                return 2;
            default:
                return 3;
        }
    };
    const IdType = nodeIdIdentifierTypeToJSON();

    const Id = nodeIdValueToJson(value);

    const pojo: NodeIdJSON = { Id };
    if (IdType !== 0) {
        pojo.IdType = IdType as 1 | 2 | 3;
    }
    if (value.namespace === 0) {
        return pojo;
    }
    const reversible = !(scheme === JsonEncodingScheme.DeprecatedNonReversible);

    if (value.namespace === 1 || reversible || !namespaceArray) {
        pojo.Namespace = value.namespace;
        return pojo;
    }
    pojo.Namespace = namespaceArray[value.namespace];
    return pojo;
}

export function opcuaJsonEncodeNodeIdAsString(value: NodeId, namespaceArray: string[]): string {
    const namespace = namespaceArray ? namespaceArray[value.namespace] : undefined;
    if (namespace) {
        if (namespace === "http://opcfoundation.org/UA/") {
            return `${nodeIdValueToString(value)}`;
        }
        const encodedNamespace = opcuaEncodeURIComponent(namespace);
        return `nsu=${encodedNamespace};${nodeIdValueToString(value)}`;
    } else {
        if (value.namespace === 0) {
            return nodeIdValueToString(value);
        }
        // If the namespace is not found, we assume it is a new namespace
        return `ns=${value.namespace};${nodeIdValueToString(value)}`;
    }
}
export function opcuaJsonEncodeExpandedNodeIdAsString(value: ExpandedNodeId, namespaceArray: string[]): string {
    // const namespace = namespaceArray ? namespaceArray[value.namespace] : undefined;
    let result = opcuaJsonEncodeNodeIdAsString(value, namespaceArray);

    if (value.namespaceUri) {
        const encodedNamespaceUri = opcuaEncodeURIComponent(value.namespaceUri);
        result = `svu=${encodedNamespaceUri};${result}`;
    } else if (value.serverIndex !== 0) {
        result = `svr=${value.serverIndex};${result}`;
    }
    return result;
}

export function opcuaJsonEncodeNodeId105(
    value: NodeId,
    scheme: JsonEncodingScheme,
    namespaceArray?: string[]
): NodeIdJSON105 | undefined {
    if (value.namespace === 0 && value.identifierType === NodeIdType.NUMERIC && value.value === 0) {
        if (scheme === JsonEncodingScheme.Compact) {
            return undefined;
        }
    }

    return opcuaJsonEncodeNodeIdAsString(value, namespaceArray || []);
}

export function opcuaJsonEncodeExpandedNodeId105(
    value: ExpandedNodeId,
    scheme: JsonEncodingScheme,
    namespaceArray?: string[]
): NodeIdJSON105 | undefined {
    if (value.namespace === 0 && value.identifierType === NodeIdType.NUMERIC && value.value === 0 && value.serverIndex === 0) {
        if (scheme === JsonEncodingScheme.Compact) {
            return undefined;
        }
    }
    return opcuaJsonEncodeExpandedNodeIdAsString(value, namespaceArray || []);
}

export function opcuaJsonEncodeNodeId(
    value: NodeId,
    scheme: JsonEncodingScheme,
    namespaceArray?: string[]
): NodeIdJSON | undefined {
    switch (scheme) {
        case JsonEncodingScheme.DeprecatedReversible:
            return opcuaJsonEncodeNodeId104(value, scheme, namespaceArray);
        case JsonEncodingScheme.DeprecatedNonReversible:
            return opcuaJsonEncodeNodeId104(value, scheme, namespaceArray);
        case JsonEncodingScheme.Compact:
            return opcuaJsonEncodeNodeId105(value, scheme, namespaceArray);
        case JsonEncodingScheme.Verbose:
            return opcuaJsonEncodeNodeId105(value, scheme, namespaceArray);
        default:
            throw new Error(`Invalid JsonEncodingScheme: ${scheme}`);
    }
}
export function opcuaJsonEncodeExpandedNodeId(
    value: ExpandedNodeId,
    scheme: JsonEncodingScheme,
    namespaceArray?: string[]
): NodeIdJSON | undefined {
    switch (scheme) {
        case JsonEncodingScheme.DeprecatedReversible:
        case JsonEncodingScheme.DeprecatedNonReversible:
            return opcuaJsonEncodeExpandedNodeId104(value, scheme, namespaceArray);
        case JsonEncodingScheme.Compact:
        case JsonEncodingScheme.Verbose:
            return opcuaJsonEncodeExpandedNodeId105(value, scheme, namespaceArray);
        default:
            throw new Error(`Invalid JsonEncodingScheme: ${scheme}`);
    }
}

export function opcuaJsonEncodeExpandedNodeId104(
    _value: ExpandedNodeId,
    scheme: JsonEncodingScheme,
    _namespaceArray?: string[]
): NodeIdJSON | undefined {
    throw new Error(`Invalid JsonEncodingScheme: ${scheme}`);
}

export function opcuaEncodeURIComponent(value: string): string {
    return value.replace(/;/g, (match) => {
        // Encode semicolon as %3B
        return encodeURIComponent(match);
    });
}
export function opcuaDecodeURIComponent(value: string): string {
    return value.replace(/%3B/g, (match) => {
        // Decode %3B back to semicolon
        return decodeURIComponent(match);
    });
}

function coerceNodeIdEx(nodeIdAsString: string, namespaceArray?: string[]): NodeId {
    //nsu=tag:acme.com,2023:schemas:data#off%3B;b=M/RbKBsRVkePCePcx24oRA==
    const match = nodeIdAsString.match(/^(nsu=([^;]+);)?(g=|s=|i=|b=)(.*)$/);
    if (match) {
        const namespaceUri = match[2];
        const identifierType = match[3];
        const identifierValue = match[4];

        let namespaceIndex: number;
        if (namespaceUri) {
            if (!namespaceArray) {
                namespaceIndex = 0; // NAMESPACE_NOT_FOUND
            } else {
                // A URI which has the RFC 3986 Percent - Encoding applied to it.
                //   Any ‘;’ in the URI shall be percent encoded.
                const decodedNamespaceUri = opcuaDecodeURIComponent(namespaceUri);
                namespaceIndex = namespaceArray.indexOf(decodedNamespaceUri);
                if (namespaceIndex < 0) {
                    namespaceIndex = 0; // NAMESPACE_NOT_FOUND
                }
            }
        } else {
            namespaceIndex = 0;
        }

        switch (identifierType) {
            case "i=":
                return new NodeId(NodeIdType.NUMERIC, parseInt(identifierValue, 10), namespaceIndex);
            case "s=":
                return new NodeId(NodeIdType.STRING, identifierValue, namespaceIndex);
            case "g=":
                return new NodeId(NodeIdType.GUID, identifierValue, namespaceIndex);
            case "b=":
                return new NodeId(NodeIdType.BYTESTRING, Buffer.from(identifierValue, "base64"), namespaceIndex);
            default:
                throw new Error(`Invalid NodeId format: ${nodeIdAsString}`);
        }
    }
    // Fallback to coerceNodeId
    return coerceNodeId(nodeIdAsString);
}
export function opcuaJsonDecodeNodeId(
    pojoOrString: NodeIdJSON | undefined,
    _builder?: ExtensionObjectBuilder | undefined,
    namespaceArray?: string[]
): NodeId {
    if (pojoOrString === null || pojoOrString === undefined) {
        throw new Error("opcuaJsonDecodeNodeId: pojoOrString cannot be null or undefined");
    }
    if (typeof pojoOrString === "string") {
        return coerceNodeIdEx(pojoOrString, namespaceArray);
    }
    const pojo = pojoOrString as NodeIdJSON104;
    const identifierType: NodeIdType = (() => {
        if (!pojo.IdType) {
            return NodeIdType.NUMERIC;
        }
        switch (pojo.IdType) {
            case 2:
                return NodeIdType.GUID;
            case 3:
                return NodeIdType.BYTESTRING;
            default:
                return NodeIdType.STRING;
        }
    })();

    const namespace: number = (() => {
        if (!pojo.Namespace) return 0;
        if (typeof pojo.Namespace === "number") {
            return pojo.Namespace;
        }
        const NAMESPACE_NOT_FOUND = 0xffff;
        if (!namespaceArray) {
            return NAMESPACE_NOT_FOUND;
        }
        const index = namespaceArray.indexOf(pojo.Namespace);
        if (index < 0) {
            return NAMESPACE_NOT_FOUND;
        }
        return index;
    })();

    const value: string | number | Buffer = (() => {
        switch (identifierType) {
            case NodeIdType.NUMERIC:
                return typeof pojo.Id === "string" ? parseInt(pojo.Id, 10) : (pojo.Id as number | 0);
            case NodeIdType.BYTESTRING:
                return Buffer.from(pojo.Id as string, "base64");
            default:
                return pojo.Id;
        }
    })();

    return new NodeId(identifierType, value, namespace);
}

export function opcuaJsonDecodeExpandedNodeId(
    pojoOrString: NodeIdJSON | undefined,
    builder?: ExtensionObjectBuilder | undefined,
    namespaceArray?: string[]
): ExpandedNodeId {
    const nodeId = opcuaJsonDecodeNodeId(pojoOrString, builder, namespaceArray);
    const result = ExpandedNodeId.fromNodeId(nodeId);
    // we don't suport serverIndex in JSON encoding
    return result;
}
