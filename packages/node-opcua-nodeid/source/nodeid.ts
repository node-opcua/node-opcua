/**
 * @module node-opcua-nodeid
 */
// tslint:disable:no-conditional-assignment
import * as chalk from "chalk";
import { isEqual } from "lodash";
import { assert } from "node-opcua-assert";
import {
    DataTypeIds,
    MethodIds,
    ObjectIds,
    ObjectTypeIds,
    ReferenceTypeIds,
    VariableIds,
    VariableTypeIds
} from "node-opcua-constants";
import { emptyGuid, Guid, isValidGuid } from "node-opcua-guid";

/**
 * `NodeIdType` an enumeration that specifies the possible types of a `NodeId` value.
 */
export enum NodeIdType {
    /**
     * @static
     * @property NUMERIC
     * @default 0x1
     */
    NUMERIC = 0x01,
    /**
     * @static
     * @property STRING
     * @default 0x2
     */
    STRING = 0x02,
    /**
     * @static
     * @property GUID
     * @default 0x3
     */
    GUID = 0x03,
    /**
     * @static
     * @property BYTESTRING
     * @default 0x4
     */
    BYTESTRING = 0x04
}

/**
 * Construct a node ID
 *
 * @class NodeId
 * @example
 *
 *    ``` javascript
 *    const nodeId = new NodeId(NodeIdType.NUMERIC,123,1);
 *    ```
 * @constructor
 */
export class NodeId {
    public static NodeIdType = NodeIdType;
    public static nullNodeId: NodeId;
    public static resolveNodeId: (a: string | NodeId) => NodeId;
    public static sameNodeId: (n1: NodeId, n2: NodeId) => boolean;

    public identifierType: NodeIdType;
    public value: number | string | Buffer | Guid;
    public namespace: number;

    /**
     * @param identifierType   - the nodeID type
     * @param value            - the node id value. The type of Value depends on identifierType.
     * @param namespace        - the index of the related namespace (optional , default value = 0 )
     */
    constructor(identifierType?: NodeIdType | null, value?: any, namespace?: number) {
        if (identifierType === null || identifierType === undefined) {
            this.identifierType = NodeIdType.NUMERIC;
            this.value = 0;
            this.namespace = 0;
            return;
        }
        this.identifierType = identifierType;
        this.value = value;
        this.namespace = namespace || 0;

        // namespace shall be a UInt16
        assert(this.namespace >= 0 && this.namespace <= 0xffff);

        assert(this.identifierType !== NodeIdType.NUMERIC || (this.value >= 0 && this.value <= 0xffffffff));
        assert(this.identifierType !== NodeIdType.GUID || isValidGuid(this.value as string));
        assert(this.identifierType !== NodeIdType.STRING || typeof this.value === "string");
    }

    /**
     * get the string representation of the nodeID.
     *
     * @method toString
     * @example
     *
     *    ``` javascript
     *    const nodeid = new NodeId(NodeIdType.NUMERIC, 123,1);
     *    console.log(nodeid.toString());
     *    ```
     *
     *    ```
     *    >"ns=1;i=123"
     *    ```
     *
     * @param [options.addressSpace] {AddressSpace}
     * @return {String}
     */
    public toString(options?: { addressSpace?: any }): string {
        const addressSpace = options ? options.addressSpace : null;
        let str;
        switch (this.identifierType) {
            case NodeIdType.NUMERIC:
                str = "ns=" + this.namespace + ";i=" + this.value;
                break;
            case NodeIdType.STRING:
                str = "ns=" + this.namespace + ";s=" + this.value;
                break;
            case NodeIdType.GUID:
                str = "ns=" + this.namespace + ";g=" + this.value;
                break;
            default:
                assert(this.identifierType === NodeIdType.BYTESTRING, "invalid identifierType in NodeId : " + this.identifierType);
                if (this.value) {
                    str = "ns=" + this.namespace + ";b=" + (this.value as Buffer).toString("hex");
                } else {
                    str = "ns=" + this.namespace + ";b=<null>";
                }
                break;
        }

        if (addressSpace) {
            if (this.namespace === 0 && this.identifierType === NodeIdType.NUMERIC) {
                // find standard browse name
                const name = reverse_map(this.value.toString()) || "<undefined>";
                str += " " + chalk.green.bold(name);
            } else if (addressSpace.findNode) {
                // let use the provided address space to figure out the browseNode of this node.
                // to make the message a little bit more useful.
                const n = addressSpace.findNode(this);
                str += " " + (n ? n.browseName.toString() : " (????)");
            }
        }
        return str;
    }

    /**
     * convert nodeId to a JSON string. same as {@link NodeId#toString }
     */
    public toJSON(): string {
        return this.toString();
    }

    public displayText(): string {
        if (this.namespace === 0 && this.identifierType === NodeIdType.NUMERIC) {
            const name = reverse_map(this.value.toString());
            if (name) {
                return name + " (" + this.toString() + ")";
            }
        }
        return this.toString();
    }

    /**
     * returns true if the NodeId is null or empty
     */
    public isEmpty(): boolean {
        switch (this.identifierType) {
            case NodeIdType.NUMERIC:
                return this.value === 0;
            case NodeIdType.STRING:
                return !this.value || (this.value as string).length === 0;
            case NodeIdType.GUID:
                return !this.value || this.value === emptyGuid;
            default:
                assert(this.identifierType === NodeIdType.BYTESTRING, "invalid identifierType in NodeId : " + this.identifierType);
                return !this.value || (this.value as Buffer).length === 0;
        }
    }
}

NodeId.nullNodeId = new NodeId();

export type NodeIdLike = string | NodeId | number;

const regexNamespaceI = /ns=([0-9]+);i=([0-9]+)/;
const regexNamespaceS = /ns=([0-9]+);s=(.*)/;
const regexNamespaceB = /ns=([0-9]+);b=(.*)/;
const regexNamespaceG = /ns=([0-9]+);g=(.*)/;

/**
 * Convert a value into a nodeId:
 * @class opcua
 * @method coerceNodeId
 * @static
 *
 * @description:
 *    - if nodeId is a string of form : "i=1234" => nodeId({value=1234, identifierType: NodeIdType.NUMERIC})
 *    - if nodeId is a string of form : "s=foo"  => nodeId({value="foo", identifierType: NodeIdType.STRING})
 *    - if nodeId is a {@link NodeId} :  coerceNodeId returns value
 * @param value
 * @param namespace {number}
 */
export function coerceNodeId(value: any, namespace?: number): NodeId {
    let matches;
    let twoFirst;
    if (value instanceof NodeId) {
        return value;
    }

    value = value || 0;
    namespace = namespace || 0;

    let identifierType = NodeIdType.NUMERIC;

    if (typeof value === "string") {
        identifierType = NodeIdType.STRING;

        twoFirst = value.substr(0, 2);
        if (twoFirst === "i=") {
            identifierType = NodeIdType.NUMERIC;
            value = parseInt(value.substr(2), 10);
        } else if (twoFirst === "s=") {
            identifierType = NodeIdType.STRING;
            value = value.substr(2);
        } else if (twoFirst === "b=") {
            identifierType = NodeIdType.BYTESTRING;
            value = Buffer.from(value.substr(2), "hex");
        } else if (twoFirst === "g=") {
            identifierType = NodeIdType.GUID;
            value = value.substr(2);
        } else if (isValidGuid(value)) {
            identifierType = NodeIdType.GUID;
        } else if ((matches = regexNamespaceI.exec(value)) !== null) {
            identifierType = NodeIdType.NUMERIC;
            namespace = parseInt(matches[1], 10);
            value = parseInt(matches[2], 10);
        } else if ((matches = regexNamespaceS.exec(value)) !== null) {
            identifierType = NodeIdType.STRING;
            namespace = parseInt(matches[1], 10);
            value = matches[2];
        } else if ((matches = regexNamespaceB.exec(value)) !== null) {
            identifierType = NodeIdType.BYTESTRING;
            namespace = parseInt(matches[1], 10);
            value = Buffer.from(matches[2], "hex");
        } else if ((matches = regexNamespaceG.exec(value)) !== null) {
            identifierType = NodeIdType.GUID;
            namespace = parseInt(matches[1], 10);
            value = matches[2];
        } else {
            throw new Error("String cannot be coerced to a nodeId : " + value);
        }
    } else if (value instanceof Buffer) {
        identifierType = NodeIdType.BYTESTRING;
    } else if (value instanceof Object) {
        // it could be a Enum or a NodeId Like object
        const tmp = value;
        value = tmp.value;
        namespace = namespace || tmp.namespace;
        identifierType = tmp.identifierType || identifierType;
        return new NodeId(identifierType, value, namespace);
    }
    return new NodeId(identifierType, value, namespace);
}

const regEx1 = /^(s|g|b|i|ns)=/;
/**
 * construct a node Id from a value and a namespace.
 * @class opcua
 * @method makeNodeId
 * @static
 * @param {String|Buffer} value
 * @param [namespace]=0 {Number} the node id namespace
 * @return {NodeId}
 */
export function makeNodeId(value: string | Buffer | number, namespace?: number) {
    value = value || 0;
    namespace = namespace || 0;

    let identifierType = NodeIdType.NUMERIC;
    if (typeof value === "string") {
        if (value.match(regEx1)) {
            throw new Error("please use coerce NodeId instead");
        }
        //            1         2         3
        //  012345678901234567890123456789012345
        // "72962B91-FA75-4AE6-8D28-B404DC7DAF63"
        if (isValidGuid(value)) {
            identifierType = NodeIdType.GUID;
        } else {
            identifierType = NodeIdType.STRING;
        }
    } else if (value instanceof Buffer) {
        identifierType = NodeIdType.BYTESTRING;
    }

    const nodeId = new NodeId(identifierType, value, namespace);
    return nodeId;
}

// reverse maps
let _nodeIdToNameIndex: any = {};
let _nameToNodeIdIndex: any = {};

const regName = /[a-zA-Z_].*/;

(function build_standard_nodeid_indexes() {
    function expand_map(directIndex: any) {
        for (const name in directIndex) {
            if (directIndex.hasOwnProperty(name) && regName.exec(name) !== null) {
                const value = directIndex[name];
                _nodeIdToNameIndex[value] = name;
                _nameToNodeIdIndex[name] = new NodeId(NodeIdType.NUMERIC, value, 0);
            }
        }
    }

    _nodeIdToNameIndex = {};
    _nameToNodeIdIndex = {};
    expand_map(ObjectIds);
    expand_map(ObjectTypeIds);
    expand_map(VariableIds);
    expand_map(VariableTypeIds);
    expand_map(MethodIds);
    expand_map(ReferenceTypeIds);
    expand_map(DataTypeIds);
})();

function reverse_map(nodeId: string) {
    return _nodeIdToNameIndex[nodeId];
}

/**
 * @class opcua
 * @method resolveNodeId
 * @static
 * @param nodeIdOrString
 * @return the nodeId
 */
export function resolveNodeId(nodeIdOrString: NodeIdLike): NodeId {
    let nodeId;

    const rawId = typeof nodeIdOrString === "string" ? _nameToNodeIdIndex[nodeIdOrString] : undefined;
    if (rawId !== undefined) {
        return rawId;
    } else {
        nodeId = coerceNodeId(nodeIdOrString);
    }
    return nodeId;
}

NodeId.resolveNodeId = resolveNodeId;

export function sameNodeId(n1: NodeId, n2: NodeId): boolean {
    if (n1.identifierType !== n2.identifierType) {
        return false;
    }
    if (n1.namespace !== n2.namespace) {
        return false;
    }
    switch (n1.identifierType) {
        case NodeIdType.NUMERIC:
        case NodeIdType.STRING:
            return n1.value === n2.value;
        default:
            return isEqual(n1.value, n2.value);
    }
}

NodeId.sameNodeId = sameNodeId;
