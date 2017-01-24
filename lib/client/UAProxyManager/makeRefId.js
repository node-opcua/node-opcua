import { ReferenceTypeIds } from "lib/opcua_node_ids";
import { ObjectTypeIds } from "lib/opcua_node_ids";
import { makeNodeId } from "lib/datamodel/nodeid";



function makeRefId(referenceTypeName) {
  const nodeId = makeNodeId(ReferenceTypeIds[referenceTypeName] || ObjectTypeIds[referenceTypeName]);

    // istanbul ignore next
  if (nodeId.isEmpty()) {
    throw new Error("makeRefId: cannot find ReferenceTypeName + ", referenceTypeName);
  }
  return nodeId;
}

export default makeRefId;
