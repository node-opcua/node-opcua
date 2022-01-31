/**
 * @module node-opcua-nodeid
 */
import { assert } from "console";
import { Guid } from "node-opcua-guid";
import { NodeId, NodeIdType } from "./nodeid";
import { Namespace } from "node-opcua-address-space"

/**
 * An ExpandedNodeId extends the NodeId structure.
 *
 * An ExpandedNodeId extends the NodeId structure by allowing the NamespaceUri to be
 * explicitly specified instead of using the NamespaceIndex. The NamespaceUri is optional. If it
 * is specified then the NamespaceIndex inside the NodeId shall be ignored.
 *
 * The ExpandedNodeId is encoded by first encoding a NodeId as described in Clause 5 .2.2.9
 * and then encoding NamespaceUri as a String.
 *
 * An instance of an ExpandedNodeId may still use the NamespaceIndex instead of the
 * NamespaceUri. In this case, the NamespaceUri is not encoded in the stream. The presence of
 * the NamespaceUri in the stream is indicated by setting the NamespaceUri flag in the encoding
 * format byte for the NodeId.
 *
 * If the NamespaceUri is present then the encoder shall encode the NamespaceIndex as 0 in
 * the stream when the NodeId portion is encoded. The unused NamespaceIndex is included in
 * the stream for consistency,
 *
 * An ExpandedNodeId may also have a ServerIndex which is encoded as a UInt32 after the
 * NamespaceUri. The ServerIndex flag in the NodeId encoding byte indicates whether the
 * ServerIndex is present in the stream. The ServerIndex is omitted if it is equal to zero.
 *
 * @class  ExpandedNodeId
 * @extends NodeId
 *
 *
 *
 * @param identifierType   - the nodeID type
 * @param value            - the node id value. The type of Value depends on identifierType.
 * @param namespace        - the index of the related namespace (optional , default value = 0 )
 * @param namespaceUri     - NamespaceUri
 * @param serverIndex      - the server Index
 * @constructor
 */
export class ExpandedNodeId extends NodeId {
    public static nullExpandedNodeId = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);

    public static fromNodeId(nodeId: NodeId, namespaceUri?: string, serverIndex?: number): ExpandedNodeId {
        return new ExpandedNodeId(nodeId.identifierType, nodeId.value, nodeId.namespace, namespaceUri, serverIndex);
    }

    public namespaceUri: null | string;
    public serverIndex: number;

    public constructor(forDeserialization: null);
    public constructor(
        identifierType: NodeIdType,
        value: number | string | Guid | Buffer,
        namespace: number,
        namespaceUri?: null | string,
        serverIndex?: number
    );
    public constructor(
        identifierType?: NodeIdType | null,
        value?: number | string | Guid | Buffer,
        namespace?: number,
        namespaceUri?: null | string,
        serverIndex?: number
    ) {
        super(identifierType, value, namespace);
        this.namespaceUri = namespaceUri || null;
        this.serverIndex = serverIndex || 0;
    }

    /**
     * @method toString
     * @return {string}
     */
    public toString(): string {
        let str = "";
        if (this.serverIndex) {
            str += "svr=" + this.serverIndex + ";";
        }
        if (this.namespaceUri) {
            str += "nsu=" + this.namespaceUri + ";" + NodeId.prototype.toString.call(this).replace("ns=0;", "");
        }
        return str;
    }

    /**
     * convert nodeId to a JSON string. same as {@link NodeId#toString }
     * @method  toJSON
     * @return {String}
     */
    public toJSON(): any {
        return this.toString();
    }
}

export function coerceExpandedNodeId(value: unknown, namespaceArray?: Namespace[]): ExpandedNodeId {
    if (value === undefined) {
        return new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0, null, 0);
    }

    let serverIndex: number = 0;
    let namespaceUri = null;
    let namespaceIndex: number = 0;
    let identifierType: NodeIdType = NodeIdType.NUMERIC;
    let identifier: string | number | Buffer = "";

    if (typeof value === "string") {
        /*
            https://reference.opcfoundation.org/Core/docs/Part6/5.3.1/#5.3.1.11

            svr=<serverindex>;ns=<namespaceindex>;<type>=<value>
            or
            svr=<serverindex>;nsu=<uri>;<type>=<value>
        */
        const stringElements: string[] = value.split(";");
        stringElements.forEach(function (element: string) {
        
            let [k, v] = element.split("="); // key, value
    
            switch (k) {
                case "ns":
                    // namespace
                    namespaceIndex = Number(v);
                    break;
                case "i":
                    // numeric identifier
                    identifierType = NodeIdType.NUMERIC;
                    identifier = Number(v)
                    break;
                case "s":
                    // string identifier
                    identifierType = NodeIdType.STRING;
                    identifier = v
                    break;
                case "g":
                    // guid identifier
                    identifierType = NodeIdType.GUID;
                    identifier = v
                    break;
                case "b":
                    // bytestring identifier
                    identifierType = NodeIdType.BYTESTRING;
                    identifier = Buffer.from(v);
                    break;
                case "srv":
                    serverIndex = Number(v);
                    // serverindex
                case "nsu":
                    // namespaceuri
                    namespaceUri = v;
                default: 
                    break;
            }
        });
        return new ExpandedNodeId(identifierType, identifier, namespaceIndex, namespaceUri, serverIndex)
    } else if (value instanceof NodeId) {
        let n;
        n = value;
        if (namespaceArray) {
            namespaceUri = namespaceArray[n.namespace].namespaceUri;
        }
        namespaceIndex = n.namespace;
        identifierType = n.identifierType;
        identifier = n.value;
        return new ExpandedNodeId(identifierType, identifier, namespaceIndex, namespaceUri, serverIndex);
    }
    else {
        return new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0, null, 0);
    }
}

/**
 * @method  makeExpandedNodeId
 * @param  value
 * @param [namespace=0] the namespace
 * @return {ExpandedNodeId}
 */
export function makeExpandedNodeId(value: unknown, namespace?: number): ExpandedNodeId {
    if (value === undefined && namespace === undefined) {
        return new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0, null, 0);
    }
    const serverIndex = 0;
    let n;
    const namespaceUri = null;

    if (value instanceof ExpandedNodeId) {
        // construct from a ExpandedNodeId => copy
        n = value;
        return new ExpandedNodeId(n.identifierType, n.value, n.namespace, n.namespaceUri, n.serverIndex);
    }
    if (value instanceof NodeId) {
        // construct from a nodeId
        n = value;
        return new ExpandedNodeId(n.identifierType, n.value, n.namespace, namespaceUri, serverIndex);
    }

    const valueInt = parseInt(value as string, 10);
    if (!isFinite(valueInt)) {
        throw new Error(" cannot makeExpandedNodeId out of " + value);
    }
    namespace = namespace || 0;
    return new ExpandedNodeId(NodeIdType.NUMERIC, valueInt, namespace, namespaceUri, serverIndex);
}
