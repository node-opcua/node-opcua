/**
 * @module node-opcua-service-browse
 */
import {
    BrowseDescription,
    BrowseNextRequest, BrowseNextResponse,
    BrowseRequest, BrowseResponse,
    BrowseResult,
    ReferenceDescription, ViewDescription
} from "node-opcua-types";

import { NodeClass } from "node-opcua-data-model";

export { BrowseDirection } from "node-opcua-data-model";

export {
    ReferenceDescription,
    BrowseResult, BrowseDescription, BrowseDescriptionOptions,
    BrowseRequestOptions,
    BrowseNextRequest, BrowseNextResponse, BrowseNextRequestOptions,
    ViewDescription,
    BrowseRequest, BrowseResponse
} from "node-opcua-types";

BrowseResult.schema.fields[1].defaultValue =  null;

BrowseDescription.schema.fields[0].documentation = "The id of the node to browse.";
BrowseDescription.schema.fields[1].documentation = "The direction of the references to return.";
BrowseDescription.schema.fields[2].documentation = "The type of references to return." +
    "Specifies the NodeId of the ReferenceType to follow. Only instances of this ReferenceType or" +
    " its subtype are returned. If not specified then all ReferenceTypes are returned and includeSubtypes is ignored.";
BrowseDescription.schema.fields[3].documentation = "Includes subtypes of the reference type.";
// mask :
//  bit
//   0   Object
//   1   Variable
//   2   Method
//   3   ObjectType
//   4   VariableType
//   5   ReferenceType
//   6   DataType
//   7   View
BrowseDescription.schema.fields[4].documentation =
    "A mask indicating which node classes to return. 0 means return all nodes.";
// mask : (see ResultMask)
//  bit
//   0   ReferenceType
//   1   IsForward
//   2   NodeClass
//   3   BrowseName
//   4   DisplayName
//   5   TypeDefinition
BrowseDescription.schema.fields[5].documentation =
    "A mask indicating which fields in the ReferenceDescription should be returned in the results.";

BrowseNextRequest.schema.fields[0].documentation = "A standard header included in all requests sent to a server.";
/*
 *
 * A Boolean parameter with the following values:
 *   TRUE:   passed continuationPoints shall be reset to free resources in the Server. The continuation points
 *           are released and the results and diagnosticInfos arrays are empty.
 *   FALSE:  passed continuationPoints shall be used to get the next set of browse information.
 *
 * A Client shall always use the continuation point returned by a Browse or
 * BrowseNext response to free the resources for the continuation point in the
 * Server. If the Client does not want to get the next set of browse information,
 * BrowseNext shall be called with this parameter set to TRUE.
 */
BrowseNextRequest.schema.fields[1].documentation =
    "If TRUE the continuation points are released and no results are returned.";
/*
 * A list of Server-defined opaque values that represent continuation points. The value for a continuation point
 * was returned to the Client in a previous Browse or BrowseNext response. These values are used to identify the
 * previously processed Browse or BrowseNext request that is being continued and the point in the result set
 * from which the browse response is to continue
 * Clients may mix continuation points from different Browse or BrowseNext responses.
 */
BrowseNextRequest.schema.fields[2].documentation = "The maximum number of references to return in the response.";

BrowseNextResponse.schema.documentation = "Browse the references for one or more nodes from the server address space.";
BrowseNextResponse.schema.fields[0].documentation = "A standard header included in all responses returned by servers.";
BrowseNextResponse.schema.fields[1].documentation = "The results for the browse operations.";
BrowseNextResponse.schema.fields[2].documentation = "The diagnostics associated with the results.";

BrowseRequest.schema.documentation = "Browse the references for one or more nodes from the server address space.";
BrowseRequest.schema.fields[0].documentation = "A standard header included in all requests sent to a server.";
/*
 * An empty ViewDescription value indicates the entire AddressSpace.
 * Use of the empty ViewDescription value causes all References of the nodesToBrowse to be returned. Use of any
 * other View causes only the References of the nodesToBrowse that are defined for that View to be returned.
 */
BrowseRequest.schema.fields[1].documentation = "The view to browse.";
// Indicates the maximum number of references to return for each starting Node
// specified in the request. The value 0 indicates that the Client is imposing no
// limitation (see 7.5 for Counter definition).
BrowseRequest.schema.fields[2].documentation = "The maximum number of references to return in the response.";
BrowseRequest.schema.fields[3].documentation = "The list of nodes to browse.";

BrowseResponse.schema.documentation = "Browse the references for one or more nodes from the server address space.";
BrowseResponse.schema.fields[0].documentation = "A standard header included in all responses returned by servers.";
BrowseResponse.schema.fields[1].documentation = "The results for the browse operations.";
BrowseResponse.schema.fields[2].documentation = "The diagnostics associated with the results.";

BrowseResult.schema.documentation = "The result of a browse operation.";
BrowseResult.schema.fields[0].documentation = "A code indicating any error during the operation.";
BrowseResult.schema.fields[1].documentation =
    "A value that indicates the operation is incomplete and can be continued by calling BrowseNext.";

BrowseResult.schema.fields[2].documentation = "A list of references that meet the criteria specified in the request.";

ReferenceDescription.schema.documentation = "The description of a reference.";
ReferenceDescription.schema.fields[0].documentation = "The type of references.";
ReferenceDescription.schema.fields[1].documentation = "TRUE if the reference is a forward reference.";
ReferenceDescription.schema.fields[2].documentation = "The id of the target node.";
ReferenceDescription.schema.fields[3].documentation = "The browse name of the target node.";
ReferenceDescription.schema.fields[4].documentation = "The display name of the target node.";
ReferenceDescription.schema.fields[5].documentation = "The node class of the target node.";
ReferenceDescription.schema.fields[6].documentation = "The type definition of the target node.";

ViewDescription.schema.documentation =  "the view to browse.";
// ViewDescription : NodeId of the View to Query. A null value indicates the entire AddressSpace.
ViewDescription.schema.fields[0].documentation =  "The node id of the view.";
// The time date desired. The corresponding version is the one with the closest
// previous creation timestamp. Either the Timestamp or the viewVersion
// parameter may be set by a Client, but not both. If ViewVersion is set this
// parameter shall be null.
ViewDescription.schema.fields[1].documentation =   "Browses the view at or before this time.";
// The version number for the View desired. When Nodes are added to or removed from a View, the value of a
// View‟s ViewVersion Property is updated. Either the Timestamp or the viewVersion parameter may be set by
// a Client, but not both.
// The ViewVersion Property is defined in Part 3. If timestamp is set this parameter
// shall be 0. The current view is used if timestamp is null and viewVersion is 0.
ViewDescription.schema.fields[2].documentation =  "Browses a specific version of the view .";
