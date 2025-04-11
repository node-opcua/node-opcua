/* eslint-disable complexity */
/**
 * @module node-opcua-nodeid
 */
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
import { emptyGuid, Guid, isValidGuid, normalizeGuid } from "node-opcua-guid";

/**
 * `NodeIdType` an enumeration that specifies the possible types of a `NodeId` value.
 */
export enum NodeIdType {
    NUMERIC = 0x01,
    STRING = 0x02,
    GUID = 0x03,
    BYTESTRING = 0x04
}

// function defaultValue(identifierType: NodeIdType.BYTESTRING): null;
// function defaultValue(identifierType: NodeIdType.STRING): "";
// function defaultValue(identifierType: NodeIdType.NUMERIC): 0;
// function defaultValue(identifierType: NodeIdType.GUID): string;
function defaultValue(identifierType: NodeIdType): string | 0 | Buffer  {
    switch (identifierType) {
        case NodeIdType.GUID: return emptyGuid;
        case NodeIdType.BYTESTRING: return null as any as Buffer;// Buffer.alloc(0);
        case NodeIdType.STRING: return "";
        case NodeIdType.NUMERIC: return 0;
        default:
            throw new Error("invalid identifierType");
    }
}
/**
 * `NodeId` specialization for numeric nodeIds.
 */
export interface INodeIdNumeric extends NodeId {
    identifierType: NodeIdType.NUMERIC;
    value: number;
}
/**
 * `NodeId` specialization for GUID  nodeIds.
 */
export interface INodeIdGuid extends NodeId {
    identifierType: NodeIdType.GUID;
    value: string;
}
/**
 * `NodeId` specialization for ByteString  nodeIds (opaque).
 */
export interface INodeIdByteString extends NodeId {
    identifierType: NodeIdType.BYTESTRING;
    value: Buffer;
}

/**
 * `NodeId` specialization for String  nodeId.
 */
export interface INodeIdString extends NodeId {
    identifierType: NodeIdType.STRING;
    value: string;
}
/**
 * `NodeId` specialization for all possible types of NodeIds.
 */
export type INodeId = INodeIdNumeric | INodeIdGuid | INodeIdString | INodeIdByteString;



/**
 * 
 * This class holds a OPC-UA node identifier.
 * 
 * Nodes are unambiguously identified using a constructed
 * identifier called the NodeId. Some Servers may accept
 * alternative NodeIds in addition to the canonical NodeId
 * represented in this Attribute. 
 * 
 * A Server shall persist the NodeId of a Node, that is,
 * it shall not generate new
 * NodeIds when rebooting. 
 *
 */
export class NodeId {
    public static NodeIdType = NodeIdType;
    public static nullNodeId: NodeId;
    public static resolveNodeId: (a: string | NodeId) => NodeId;

    /**
     */
    public static sameNodeId: (n1: NodeId, n2: NodeId) => boolean;

    public identifierType: NodeIdType;
    public value: number | string | Buffer | Guid;
    public namespace: number;

    /**
     * construct a node Id from a type, a value and a namespace index.
     *
     * @param identifierType   - the nodeID type
     * @param value            - the node id value. The type of Value depends on identifierType.
     * @param namespace        - the index of the related namespace (optional , default value = 0 )
     *  
     * @example
     *
     * ```javascript
     * const nodeId = new NodeId(NodeIdType.NUMERIC,123,1);
     * ```
     */
    constructor(identifierType?: NodeIdType | null, value?: number | string | Buffer | Guid, namespace?: number) {
        if (identifierType === null || identifierType === undefined) {
            this.identifierType = NodeIdType.NUMERIC;
            this.value = 0;
            this.namespace = 0;
            return;
        }

        this.identifierType = identifierType;
        this.value = value || defaultValue(identifierType as NodeIdType);
        this.namespace = namespace || 0;

        // namespace shall be a UInt16
        assert(this.namespace >= 0 && this.namespace <= 0xffff, "NodeId: invalid namespace value");
        assert(
            this.identifierType !== NodeIdType.NUMERIC ||
                (this.value !== null && (this.value as number) >= 0 && (this.value as number) <= 0xffffffff)
        );
        assert(this.identifierType !== NodeIdType.GUID || isValidGuid(this.value as string), "NodeId: Guid is invalid");
        assert(this.identifierType !== NodeIdType.STRING || typeof this.value === "string", "cannot  empty string");
        if (this.identifierType === NodeIdType.GUID) {
            this.value = normalizeGuid(value as string);
        }
    }

    /**
     * get the string representation of the nodeID.
     *
     * @example
     *
     * by default, toString will return the "ns=" representation
     *
     * ```javascript
     * const nodeid = new NodeId(NodeIdType.NUMERIC, 123,1);
     * console.log(nodeid.toString());
     * ```
     *
     *  ```
     *  >"ns=1;i=123"
     *  ```
     * @example
     *
     *  toString can also be used to make the nsu= version of the nodeid.
     *
     *  ```javascript
     *  const namespaceArray = ["http://opcfoundation.com/UA/","http://mynamespace2"];
     *  const nodeid = new NodeId(NodeIdType.STRING, "Hello",1);
     *  console.log(nodeid.toString({namespaceArray}));
     *  ```
     *  ```
     *  >"nsu=http://mynamespace;i=123"
     *  ```
     * @example
     *
     *  passing an addressSpace to the toString options will decorate the nodeId
     *  with the BrowseName of the node.
     *
     *  ```javascript
     * const addressSpace = getAddressSpace();
     * const nodeid = new NodeId(NodeIdType.NUMERIC, 123,1);
     * console.log(nodeid.toString({addressSpace}));
     * ```
     * ```
     * >"nsu=http://mynamespace;i=123 (MyBrowseName)"
     * ```
     *
     *
     * @param [options.addressSpace] {AddressSpace}
     * @return {String}
     */
    public toString(options?: { addressSpace?: any; namespaceArray?: string[] }): string {
        const addressSpace = options ? options.addressSpace : null;

        const namespacePart: string = options?.namespaceArray
            ? this.namespace == 0
                ? ""
                : `nsu=${options.namespaceArray[this.namespace] || `<unknown namespace with index ${this.namespace}>`};`
            : `ns=${this.namespace};`;

        let str;
        const _this = this as INodeId;
        switch (_this.identifierType) {
            case NodeIdType.NUMERIC:
                str = `${namespacePart}i=${_this.value}`;
                break;
            case NodeIdType.STRING:
                str = `${namespacePart}s=${_this.value}`;
                break;
            case NodeIdType.GUID:
                str = `${namespacePart}g=${normalizeGuid(_this.value)}`;
                break;
            default:
                assert(this.identifierType === NodeIdType.BYTESTRING, "invalid identifierType in NodeId : " + this.identifierType);
                if (this.value) {
                    str = `${namespacePart}b=${(this.value as Buffer).toString("base64")}`;
                } else {
                    str = `${namespacePart}b=<null>`;
                }
                break;
        }

        if (addressSpace) {
            if (this.namespace === 0 && _this.identifierType === NodeIdType.NUMERIC) {
                // find standard browse name
                const name = reverse_map((this.value || 0).toString()) || "<undefined>";
                str += " " + name;
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
     * convert nodeId to a JSON string. same as {@link NodeId.toString }
     */
    public toJSON(options?: { namespaceArray?: string[] }): string {
        return this.toString(options);
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
        const _this = this as INodeId;
        switch (_this.identifierType) {
            case NodeIdType.NUMERIC:
                return _this.value === 0;
            case NodeIdType.STRING:
                return !_this.value;
            case NodeIdType.GUID:
                return !_this.value || _this.value === emptyGuid;
            default:
                return !_this.value || (_this.value as Buffer).length === 0;
        }
    }
}

/**
 * a fixed instance of a null NodeId 
 */
NodeId.nullNodeId = new Proxy(
    new NodeId(NodeIdType.NUMERIC, 0, 0),
    {
        get: (target: NodeId, prop: string) => {
            return (target as any)[prop];
        },
        set: () => {
            throw new Error("Cannot assign a value to constant NodeId.nullNodeId");
        }
    });


/**
 * anything that could be turned into a nodeId
 */
export type NodeIdLike = string | NodeId | number;

/**
 * @private
 */
const regexNamespaceI = /ns=([0-9]+);i=([0-9]+)/;
const regexNamespaceS = /ns=([0-9]+);s=(.*)/;
const regexNamespaceB = /ns=([0-9]+);b=(.*)/;
const regexNamespaceG = /ns=([0-9]+);g=([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/;

const regexNSU = /nsu=(.*);(.*)/;

/**
 * 
 */
export interface ResolveNodeIdOptions {
    namespaceArray?: string[];
    defaultNamespaceIndex?: number ; 
}
/**
 * Convert a value into a nodeId:
 *
 * @description:
 *    - if nodeId is a string of form : "i=1234"  => nodeId({value=1234, identifierType: NodeIdType.NUMERIC})
 *    - if nodeId is a string of form : "s=foo"   => nodeId({value="foo", identifierType: NodeIdType.STRING})
 *    - if nodeId is a string of form : "b=ABCD=" => nodeId({value=decodeBase64("ABCD="), identifierType: NodeIdType.BYTESTRING})
 *    - if nodeId is a {@link NodeId} :  coerceNodeId returns value
 * 
 */
export function coerceNodeId(value: unknown, namespaceOptions?: number | ResolveNodeIdOptions): NodeId {
    let matches;
    let twoFirst;
    if (value instanceof NodeId) {
        return value;
    }

    value = value || 0;

    let namespace = (typeof namespaceOptions === "number" ? namespaceOptions as number : namespaceOptions?.defaultNamespaceIndex )|| 0;
    
    const namespaceArray: string[] | undefined = (namespaceOptions as { namespace?: number, namespaceArray: string[] }) ?.namespaceArray || undefined;

    let identifierType = NodeIdType.NUMERIC;

    if (typeof value === "string") {
        identifierType = NodeIdType.STRING;

        twoFirst = value.substring(0, 2);
        if (twoFirst === "i=") {
            identifierType = NodeIdType.NUMERIC;
            value = parseInt(value.substring(2), 10);
        } else if (twoFirst === "s=") {
            identifierType = NodeIdType.STRING;
            value = value.substring(2);
        } else if (twoFirst === "b=") {
            identifierType = NodeIdType.BYTESTRING;
            value = Buffer.from(value.substring(2), "base64");
        } else if (twoFirst === "g=") {
            identifierType = NodeIdType.GUID;
            value = normalizeGuid(value.substring(2));
            assert(isValidGuid(value as string));
        } else if (isValidGuid(value)) {
            identifierType = NodeIdType.GUID;
            value = normalizeGuid(value);
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
            value = Buffer.from(matches[2], "base64");
        } else if ((matches = regexNamespaceG.exec(value)) !== null) {
            identifierType = NodeIdType.GUID;
            namespace = parseInt(matches[1], 10);
            value = normalizeGuid(matches[2]);
        } else {

            // eslint-disable-next-line no-empty
            if (namespaceArray && (matches = regexNSU.exec(value))!==null) {
                const namespaceIndex = namespaceArray.indexOf(matches[1]);
                if (namespaceIndex === -1) {
                    throw new Error("Cannot find namespace with index " + matches[1] + " in " + namespaceArray.join(","));
                }
                const nid = coerceNodeId(matches[2], namespace);
                nid.namespace = namespaceIndex;
                return nid;
            } else {
                throw new Error("String cannot be coerced to a nodeId : " + value);
            }
        }
    } else if (value instanceof Buffer) {
        identifierType = NodeIdType.BYTESTRING;
    } else if (value instanceof Object) {
        // it could be a Enum or a NodeId Like object
        const tmp = value as any;
        value = tmp.value;
        namespace = namespace || tmp.namespace;
        identifierType = tmp.identifierType || identifierType;
        return new NodeId(identifierType, value as any, namespace);
    }
    return new NodeId(identifierType, value as any, namespace);
}

const regEx1 = /^(s|g|b|i|ns)=/;
/**
 * construct a node Id from a value and a namespace.
 *
 * @param {String|Buffer} value
 * @param [namespace]=0 {Number} optional (default=0), the node id namespace
 * @return {NodeId}
 */
export function makeNodeId(value: string | Buffer | number, namespace?: number): NodeId {
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
            value = normalizeGuid(value);
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
            if (Object.prototype.hasOwnProperty.call(directIndex, name) && regName.exec(name) !== null) {
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
 * resolveNodeId can be helpful to convert a wellknown Node Name to a nodeid
 * if a wellknown node name cannot be detected, the function falls back to
 * calling coerceNodeId {@link coerceNodeId}.
 * 
 * @example
 * ```javascript
 * const nodeId = resolveNodeId("ObjectsFolder");
 * console.log(nodeId.toString());
 * ```
 * ```text
 * >ns=0;i=85
 * ```
 * 
 * ```javascript
 * const nodeId = resolveNodeId("HasComponent");
 * console.log(nodeId.toString());
 * ```
 * ```text
 * >ns=0;i=33
 * ```
 * 
 * ```javascript
 * const nodeId = resolveNodeId("ns=1;i=4444");
 * console.log(nodeId.toString());
 * ```
 * ```text
 * >ns=1;i=4444
 * ```
 * 
 */
export function resolveNodeId(nodeIdOrString: NodeIdLike, options?: ResolveNodeIdOptions): NodeId {
    let nodeId;

    const rawId = typeof nodeIdOrString === "string" ? _nameToNodeIdIndex[nodeIdOrString] : undefined;
    if (rawId !== undefined) {
        return rawId;
    } else {
        nodeId = coerceNodeId(nodeIdOrString, options);
    }
    return nodeId;
}

NodeId.resolveNodeId = resolveNodeId;

/**
 * 
 * The sameNodeId function is used to compare two NodeId objects to
 * determine if they are identical. This comparison is based on the
 * identifier type, namespace, and value of the NodeId objects.
 *

 *
 * @return {boolean} Returns true if the two NodeId objects are
 * identical, otherwise returns false.
 * 
 * @example
 * ```javascript
 * const nodeId1: NodeId = new NodeId(NodeIdType.STRING, "example", 1);
 * const nodeId2: NodeId = coerceNodeId("ns=1;s=example");
 * const areSame = sameNodeId(nodeId1, nodeId2); // returns true
 * ```
 */
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
        case NodeIdType.GUID:
            return n1.value === n2.value;
        case NodeIdType.BYTESTRING:
            return (n1.value as Buffer).toString("hex") === (n2.value as Buffer).toString("hex");
        default:
            throw new Error("Invalid identifier type");
    }
}
NodeId.sameNodeId = sameNodeId;

