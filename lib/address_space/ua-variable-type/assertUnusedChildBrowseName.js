/**
 * @module opcua.address_space
 */

import assert from "better-assert";
import util from "util";
import _ from "underscore";
import { BaseNode } from "lib/address_space/base_node";
import { coerceNodeId } from "lib/datamodel/nodeid";

import { construct_isSupertypeOf } from "../tool_isSupertypeOf";


import { NodeClass } from "lib/datamodel/nodeclass";
import { NodeId } from "lib/datamodel/nodeid";
import { makeNodeId } from "lib/datamodel/nodeid";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { AttributeIds } from "lib/services/read_service";


import { 
  make_debugLog, 
  checkDebugFlag,
  isNullOrUndefined
} from "lib/misc/utils";
import { BrowseDirection } from "lib/services/browse_service";

import { sameNodeId } from "lib/datamodel/nodeid";
import { Reference } from "lib/address_space/reference";
import { makeOptionalsMap } from "lib/address_space/make_optionals_map";


const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);




/**
 * returns true if the parent object has a child  with the provided browseName
 * @param parent
 * @param childBrowseName
 */
function hasChildWithBrowseName(parent,childBrowseName) {
  assert(parent instanceof BaseNode);
    // extract children
  const children = parent.findReferencesAsObject("HasChild", true);

  return children.filter(child => child.browseName.name.toString()  === childBrowseName).length > 0;
}

function getParent(options) {
  const parent = options.componentOf || options.organizedBy;
  return parent;
}
function assertUnusedChildBrowseName(addressSpace,options) {
  function resolveOptionalObject(node) {
    return  node ? addressSpace._coerceNode(node) : null;
  }
  options.componentOf = resolveOptionalObject(options.componentOf);
  options.organizedBy = resolveOptionalObject(options.organizedBy);

  assert(!(options.componentOf && options.organizedBy));

  const parent = getParent(options);
  if (!parent) {
    return;
  }
  assert(_.isObject(parent));

    // istanbul ignore next
    // verify that no components already exists in parent
  if (parent && hasChildWithBrowseName(parent,options.browseName)) {
    throw new Error(`object ${parent.browseName.name.toString()} have already a child with browseName ${options.browseName.toString()}`);
  }
}
export default assertUnusedChildBrowseName;
