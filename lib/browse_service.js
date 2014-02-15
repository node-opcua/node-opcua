
var factories = require("./factories");


var EnumNodeClass_Schema = {
    name: "NodeClass",
    documentation: "A mask specifying the class of the node.",
    isEnum: true,
    enumValues: {
        Unspecified:       0,  // No classes are selected.
        Object:            1,  // The node is an object.
        Variable:          2,  // The node is a variable.
        Method :           4,  // The node is a method.
        ObjectType:        8,  // The node is an object type.
        VariableType:     16,  // The node is an variable type.
        ReferenceType:    32,  // The node is a reference type.
        DataType:         64,  // The node is a data type.
        View:            128   // The node is a view.
    }
};
exports.NodeClass = factories.registerObject(EnumNodeClass_Schema);


var ViewDescription_Schema = {
    name:"ViewDescription",
    documentation:'the view to browse.',
    fields: [
        {name:"viewId" ,      fieldType:"NodeId",  documentation:"The node id of the view."},
        {name:"timestamp" ,   fieldType:"UtcTime", documentation:"Browses the view at or before this time."},
        {name:"viewVersion" , fieldType:"UInt32",  documentation:"Browses a specific version of the view ."}
    ]
};
var ViewDescription = factories.registerObject(ViewDescription_Schema);


var BrowseDescription_Schema = {
    name:"BrowseDescription",
    documentation:'A request to browse the the references from a node.',
    fields: [
        {name:"nodeId" ,            fieldType:"NodeId",          documentation:"The id of the node to browse."},
        {name:"browseDirection",    fieldType:"BrowseDirection", documentation:"The direction of the references to return."},
        {name:"referenceTypeId",    fieldType:"NodeId",          documentation:"The type of references to return."},
        {name:"includeSubtypes",    fieldType:"Boolean",         documentation:"Includes subtypes of the reference type."},
        {name:"nodeClassMask",      fieldType:"UInt32",          documentation:"A mask indicating which node classes to return. 0 means return all nodes."},
        {name:"resultMask",         fieldType:"UInt32",          documentation:"A mask indicating which fields should be returned in the results."}
    ]
};
exports.BrowseDescription = factories.registerObject(BrowseDescription_Schema);


var ReferenceDescription_Schema = {
    name:"ReferenceDescription",
    documentation:"The description of a reference.",
    id: factories.next_available_id(),
    fields: [
        {name: "referenceTypeId" ,  fieldType: "NodeId" ,         documentation:"The type of references."},
        {name: "isForward" ,        fieldType: "Boolean" ,        documentation:"TRUE if the reference is a forward reference."},
        {name: "nodeId" ,           fieldType: "ExpandedNodeId" , documentation:"The id of the target node."},
        {name: "browseName" ,       fieldType: "QualifiedName" ,  documentation:"The browse name of the target node."},
        {name: "displayName" ,      fieldType: "LocalizedText" ,  documentation:"The display name of the target node."},
        {name: "nodeClass" ,        fieldType: "NodeClass" ,      documentation:"The node class of the target node."},
        {name: "typeDefinition" ,   fieldType: "ExpandedNodeId" , documentation:"The type definition of the target node."}

    ]
};
var ReferenceDescription = factories.registerObject(ReferenceDescription_Schema);
exports.ReferenceDescription = ReferenceDescription;

factories.registerObject({name:"ContinuationPoint",subtype:"ByteString"});
factories.registerObject({name:"Counter",subtype:"UInt32"});

var BrowseResult_Schema = {
    name: "BrowseResult",
    id: factories.next_available_id(),
    documentation: "The result of a browse operation.",
    fields: [
        { name: "statusCode",                fieldType:"StatusCode",           documentation:"A code indicating any error during the operation."},
        { name: "continuationPoint",         fieldType:"ContinuationPoint",    documentation:"A value that indicates the operation is incomplete and can be continued by calling BrowseNext."},
        { name: "references" , isArray:true, fieldType:"ReferenceDescription", documentation:"A list of references that meet the criteria specified in the request."}
    ]
};
var BrowseResult = factories.registerObject(BrowseResult_Schema);
exports.BrowseResult = BrowseResult;

var EnumBrowseDirection_Schema = {
    name: "BrowseDirection",
    isEnum: true,
    enumValues: {
        Forward:        0, // Return forward references.
        Inverse:        1, //Return inverse references.
        Both:           2  // Return forward and inverse references.
    }
};
exports.BrowseDirection = factories.registerObject(EnumBrowseDirection_Schema);


var BrowseRequest_Schema = {
  name:"BrowseRequest",
  comment: "Browse the references for one or more nodes from the server address space.",
  fields: [
      {name:"requestHeader",                 fieldType:"RequestHeader",     documentation: "A standard header included in all requests sent to a server."},
      {name:"view",                          fieldType:"ViewDescription",   documentation: "The view to browse." },
      {name:"requestedMaxReferencesPerNode", fieldType:"Counter",           documentation: "The maximum number of references to return in the response."},
      {name:"nodesToBrowse",    isArray:true,fieldType:"BrowseDescription", documentation: "The list of nodes to browse."  }
  ]
};
exports.BrowseRequest= factories.registerObject(BrowseRequest_Schema);


var BrowseResponse_Schema = {
    name:"BrowseResponse",
    comment: "Browse the references for one or more nodes from the server address space.",
    fields: [
        {name:"responseHeader",                 fieldType:"ResponseHeader",     documentation: "A standard header included in all responses returned by servers."},
        {name:"results",        isArray:true,   fieldType:"BrowseResult",       documentation: "The results for the browse operations." },
        {name:"diagnosticInfos",isArray:true,  fieldType:"DiagnosticInfo",     documentation: "The diagnostics associated with the results."}
    ]
};
exports.BrowseResponse = factories.registerObject(BrowseResponse_Schema);


var BrowseNextRequest_Schema = {
    name:"BrowseNextRequest",
    comment: "Continues one or more browse operations.",
    fields: [
        {name:"requestHeader",                         fieldType:"RequestHeader",     documentation: "A standard header included in all requests sent to a server."},
        {name:"releaseContinuationPoints",             fieldType:"Boolean",           documentation: "If TRUE the continuation points are released and no results are returned." },
        {name:"continuationPoints",       isArray:true,fieldType:"ContinuationPoint", documentation: "The maximum number of references to return in the response."}
    ]
};
exports.BrowseNextRequest= factories.registerObject(BrowseNextRequest_Schema);

var BrowseNextResponse_Schema = {
    name:"BrowseNextResponse",
    comment: "Browse the references for one or more nodes from the server address space.",
    fields: [
        {name:"responseHeader",                 fieldType:"ResponseHeader",     documentation: "A standard header included in all responses returned by servers."},
        {name:"results",        isArray:true,   fieldType:"BrowseResult",       documentation: "The results for the browse operations." },
        {name:"diagnosticInfos",isArray:true,   fieldType:"DiagnosticInfo",     documentation: "The diagnostics associated with the results."}
    ]
};
exports.BrowseNextResponse = factories.registerObject(BrowseNextResponse_Schema);

