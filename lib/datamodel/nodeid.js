/* global Buffer */
/**
 * @module opcua.datamodel
 */
import Enum from "lib/misc/enum";

import assert from "better-assert";
import { isValidGuid } from "lib/datamodel/guid";
import _ from "underscore";
/**
 * `NodeIdType` an enumeration that specifies the possible types of a `NodeId` value.
 * @class NodeIdType
 */
const NodeIdType = new Enum({
    /**
     * @static
     * @property NUMERIC
     * @type EnumItem
     * @default 0x1
     */
  NUMERIC: 0x01,
    /**
     * @static
     * @property STRING
     * @type EnumItem
     * @default 0x2
     */
  STRING: 0x02,
    /**
     * @static
     * @property GUID
     * @type EnumItem
     * @default 0x3
     */
  GUID: 0x03,
    /**
     * @static
     * @property BYTESTRING
     * @type EnumItem
     * @default 0x4
     */
  BYTESTRING: 0x04
});
export { NodeIdType };

/**
 * Construct a node ID
 *
 * @class NodeId
 * @param {NodeIdType}                identifierType   - the nodeID type
 * @param {Number|String|GUID|Buffer} value            - the node id value. The type of Value depends on identifierType.
 * @param {Number}                    namespace        - the index of the related namespace (optional , default value = 0 )
 * @example
 *
 *    ``` javascript
 *    var nodeId = new NodeId(NodeIdType.NUMERIC,123,1);
 *    ```
 * @constructor
 */
function NodeId(identifierType, value, namespace) {
    /**
     * @property identifierType
     * @type {NodeIdType}
     */
  this.identifierType = NodeIdType.get(identifierType.value);

  assert(this.identifierType);
    /**
     * @property  value
     * @type  {*}
     */

  this.value = value;
    /**
     * @property namespace
     * @type {Number}
     */
  this.namespace = namespace || 0;

    // namespace shall be a UInt16
  assert(this.namespace >= 0 && this.namespace <= 0xFFFF);

  assert(this.identifierType !== NodeIdType.NUMERIC || (this.value >= 0 && this.value <= 0xFFFFFFFF));
  assert(this.identifierType !== NodeIdType.GUID || isValidGuid(this.value));
  assert(this.identifierType !== NodeIdType.STRING || typeof this.value === "string");
}
NodeId.NodeIdType = NodeIdType;

/**
 * get the string representation of the nodeID.
 *
 * @method toString
 * @example
 *
 *    ``` javascript
 *    var nodeid = new NodeId(NodeIdType.NUMERIC, 123,1);
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
NodeId.prototype.toString = function (options) {
  const addressSpace = options ? options.addressSpace : null;
  let str;
  switch (this.identifierType) {
    case NodeIdType.NUMERIC:
      str = `ns=${this.namespace};i=${this.value}`;
      break;
    case NodeIdType.STRING:
      str = `ns=${this.namespace};s=${this.value}`;
      break;
    case NodeIdType.GUID:
      str = `ns=${this.namespace};g=${this.value}`;
      break;
    default:
      assert(this.identifierType === NodeIdType.BYTESTRING, `invalid identifierType in NodeId : ${this.identifierType}`);
      str = `ns=${this.namespace};b=${this.value.toString("hex")}`;
      break;
  }

  if (addressSpace) {
    if (this.namespace === 0 && (this.identifierType === NodeIdType.NUMERIC)) {
            // find standard browse name
      const name = reverse_map(this.value) || "<undefined>";
      str += ` ${name.green.bold}`;
    } else {
            // let use the provided address space to figure out the browseNode of this node.
            // to make the message a little bit more useful.
      const n = addressSpace.findNode(this);
      str += ` ${n ? n.browseName.toString().green : " (????)"}`;
    }
  }
  return str;
};


/**
 * convert nodeId to a JSON string. same as {@link NodeId#toString }
 * @method  toJSON
 * @return {String}
 */
NodeId.prototype.toJSON = function () {
  return this.toString();
};

import { emptyGuid } from "lib/datamodel/guid";

/**
 * @method isEmpty
 * @return {Boolean} true if the NodeId is null or empty
 */
NodeId.prototype.isEmpty = function () {
  switch (this.identifierType) {
    case NodeIdType.NUMERIC:
      return this.value === 0;
    case NodeIdType.STRING:
      return !this.value || this.value.length === 0;
    case NodeIdType.GUID:
      return !this.value || this.value === emptyGuid;
    default:
      assert(this.identifierType === NodeIdType.BYTESTRING, `invalid identifierType in NodeId : ${this.identifierType}`);
      return !this.value || this.value.length === 0;
  }
};

NodeId.NullNodeId = new NodeId(NodeIdType.NUMERIC,0);

export { NodeId };


const rege_ns_i = /ns=([0-9]+);i=([0-9]+)/;
const rege_ns_s = /ns=([0-9]+);s=(.*)/;
const rege_ns_b = /ns=([0-9]+);b=(.*)/;
const rege_ns_g = /ns=([0-9]+);g=(.*)/;


/**
 * Convert a value into a nodeId:
 * @class opcua
 * @method coerceNodeId
 * @static
 *
 * @description:
 *    - if nodeId is a string of form : "i=1234" => nodeId({ namespace: 0 , value=1234  , identifierType: NodeIdType.NUMERIC})
 *    - if nodeId is a string of form : "s=foo"  => nodeId({ namespace: 0 , value="foo" , identifierType: NodeIdType.STRING})
 *    - if nodeId is a {@link NodeId} :  coerceNodeId returns value
 *
 * @param value
 * @param namespace {Integer}
 */
function coerceNodeId(value, namespace) {
  let matches;
  let two_first;

  if (value instanceof NodeId) {
    return value;
  }

  value = value || 0;
  namespace = namespace || 0;

  let identifierType = NodeIdType.NUMERIC;

  if (typeof value === "string") {
    identifierType = NodeIdType.STRING;

    two_first = value.substr(0, 2);
    if (two_first === "i=") {
      identifierType = NodeIdType.NUMERIC;
      value = parseInt(value.substr(2), 10);
    } else if (two_first === "s=") {
      identifierType = NodeIdType.STRING;
      value = value.substr(2);
    } else if (two_first === "b=") {
      identifierType = NodeIdType.BYTESTRING;
      value = Buffer.from(value.substr(2), "hex");
    } else if (two_first === "g=") {
      identifierType = NodeIdType.GUID;
      value = value.substr(2);
    } else if (isValidGuid(value)) {
      identifierType = NodeIdType.GUID;
    } else if ((matches = rege_ns_i.exec(value)) !== null) {
      identifierType = NodeIdType.NUMERIC;
      namespace = parseInt(matches[1], 10);
      value = parseInt(matches[2], 10);
    } else if ((matches = rege_ns_s.exec(value)) !== null) {
      identifierType = NodeIdType.STRING;
      namespace = parseInt(matches[1], 10);
      value = matches[2];
    } else if ((matches = rege_ns_b.exec(value)) !== null) {
      identifierType = NodeIdType.BYTESTRING;
      namespace = parseInt(matches[1], 10);
      value = Buffer.from(matches[2], "hex");
    } else if ((matches = rege_ns_g.exec(value)) !== null) {
      identifierType = NodeIdType.GUID;
      namespace = parseInt(matches[1], 10);
      value = matches[2];
    } else {
      throw new Error(`String cannot be coerced to a nodeId : ${value}`);
    }
  } else if (value instanceof Buffer) {
    identifierType = NodeIdType.BYTESTRING;
  } else if (value instanceof Object) {
    console.log("xxxx VALUE = ",value);

    const tmp = value;
    value = tmp.value;
    namespace = namespace || tmp.namespace;
    identifierType = tmp.identifierTypes;
    return new NodeId(value, namespace);
  }
  return new NodeId(identifierType, value, namespace);
}
export { coerceNodeId };


/**
 * construct a node Id from a value and a namespace.
 * @class opcua
 * @method makeNodeId
 * @static
 * @param {string|buffer} value
 * @param [namespace=0] {Integer} the node id namespace
 * @return {NodeId}
 */
const makeNodeId = function makeNodeId(value, namespace) {
  value = value || 0;
  namespace = namespace || 0;

  let identifierType = NodeIdType.NUMERIC;
  if (typeof value === "string") {
        //            1         2         3
        //  012345678901234567890123456789012345
        // "72962B91-FA75-4AE6-8D28-B404DC7DAF63"
    if (isValidGuid(value)) {
      identifierType = NodeIdType.GUID;
    } else {
      identifierType = NodeIdType.STRING;
            // detect accidental string of form "ns=x;x";
      assert(value.indexOf(";") === -1, " makeNodeId(string) ? did you mean using coerceNodeId instead? ");
    }
  } else if (value instanceof Buffer) {
    identifierType = NodeIdType.BYTESTRING;
  }

  const nodeId = new NodeId(identifierType, value, namespace);

  assert(nodeId.hasOwnProperty("identifierType"));

  return nodeId;
};

export { makeNodeId };
import nodeids from "lib/opcua_node_ids";
const DataTypeIds = nodeids.DataTypeIds;
const VariableIds = nodeids.VariableIds;
const ObjectIds = nodeids.ObjectIds;
const ObjectTypeIds = nodeids.ObjectTypeIds;
const VariableTypeIds = nodeids.VariableTypeIds;
const MethodIds = nodeids.MethodIds;
const ReferenceTypeIds = nodeids.ReferenceTypeIds;

// reverse maps
let _nodeid_to_name_index = {};
let _name_to_nodeid_index = {};

(function build_standard_nodeid_indexes() {
  function expand_map(direct_index) {
    for (const name in direct_index) {
      if (direct_index.hasOwnProperty(name)) {
        const value = direct_index[name];
        _nodeid_to_name_index[value] = name;
        _name_to_nodeid_index[name] = new NodeId(NodeIdType.NUMERIC, value, 0);
      }
    }
  }

  _nodeid_to_name_index = {};
  _name_to_nodeid_index = {};
  expand_map(ObjectIds);
  expand_map(ObjectTypeIds);
  expand_map(VariableIds);
  expand_map(VariableTypeIds);
  expand_map(MethodIds);
  expand_map(ReferenceTypeIds);
  expand_map(DataTypeIds);
}());

function reverse_map(nodeId) {
  return _nodeid_to_name_index[nodeId];
}


/**
 * @class opcua
 * @method resolveNodeId
 * @static
 * @param node_or_string {NodeId|String}
 * @return {NodeId}
 */
function resolveNodeId(node_or_string) {
  let nodeId;
  const raw_id = _name_to_nodeid_index[node_or_string];
  if (raw_id !== undefined) {
    return raw_id;
  } 
  nodeId = coerceNodeId(node_or_string);
  
  return nodeId;
}

export { resolveNodeId };


/**
 * @class NodeId
 * @method displayText
 * @return {String}
 */
NodeId.prototype.displayText = function () {
  if (this.namespace === 0 && this.identifierType === NodeIdType.NUMERIC) {
    const name = reverse_map(this.value);
    if (name) {
      return `${name} (${this.toString()})`;
    }
  }
  return this.toString();
};


function sameNodeId(n1,n2) {
  if (n1.identifierType.value !== n2.identifierType.value) {
    return false;
  }
  if (n1.namespace !== n2.namespace) {
    return false;
  }
  switch (n1.identifierType.value) {
    case NodeIdType.NUMERIC.value:
    case NodeIdType.STRING.value:
      return n1.value === n2.value;
    default:
      return _.isEqual(n1.value,n2.value);
  }
}
export { sameNodeId };
