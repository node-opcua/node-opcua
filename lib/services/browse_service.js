/**
 * Browse services
 * @module services.browse
 */
import Enum from "lib/misc/enum";
import { ResultMask } from "schemas/ResultMask_enum";
import { makeBrowsePath } from "lib/address_space/make_browse_path";
import { BrowseDirection }  from "schemas/BrowseDirection_enum";
import { ReferenceDescription } from "_generated_/_auto_generated_ReferenceDescription";
import { BrowseResult } from "_generated_/_auto_generated_BrowseResult";
import { BrowseDescription } from "_generated_/_auto_generated_BrowseDescription";
import { BrowseRequest } from "_generated_/_auto_generated_BrowseRequest";
import { BrowseResponse } from "_generated_/_auto_generated_BrowseResponse";
import { BrowseNextRequest } from "_generated_/_auto_generated_BrowseNextRequest";
import { BrowseNextResponse } from "_generated_/_auto_generated_BrowseNextResponse";
import { RegisterNodesRequest } from "_generated_/_auto_generated_RegisterNodesRequest";
import { RegisterNodesResponse } from "_generated_/_auto_generated_RegisterNodesResponse";
import { UnregisterNodesRequest } from "_generated_/_auto_generated_UnregisterNodesRequest";
import { UnregisterNodesResponse } from "_generated_/_auto_generated_UnregisterNodesResponse";
import { ApplicationDescription } from "_generated_/_auto_generated_ApplicationDescription";


// Specifies the NodeClasses of the TargetNodes. Only TargetNodes with the
// selected NodeClasses are returned. The NodeClasses are assigned the
// following bits:
// If set to zero, then all NodeClasses are returned.
// @example
//    var mask = NodeClassMask.get("Object |  ObjectType");
//    mask.value.should.eql(1 + (1<<3));
const NodeClassMask = new Enum({
  Object: (1 << 0),
  Variable: (1 << 1),
  Method: (1 << 2),
  ObjectType: (1 << 3),
  VariableType: (1 << 4),
  ReferenceType: (1 << 5),
  DataType: (1 << 6),
  View: (1 << 7)
});


// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
export function makeNodeClassMask(str) {
  const classMask = NodeClassMask.get(str);
  /* istanbul ignore next */
  if (!classMask) {
    throw new Error(` cannot find class mask for ${str}`);
  }
  return classMask.value;
}


// The ReferenceDescription type is defined in 7.24.
// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
export function makeResultMask(str) {
  return ResultMask.get(str).value;
}


export { 
  NodeClassMask,
  makeBrowsePath,
  BrowseDirection,
  ReferenceDescription,
  BrowseResult,
  BrowseDescription,
  BrowseRequest,
  BrowseResponse,
  BrowseNextRequest,
  BrowseNextResponse,
  RegisterNodesRequest,
  RegisterNodesResponse,
  UnregisterNodesRequest,
  UnregisterNodesResponse };
