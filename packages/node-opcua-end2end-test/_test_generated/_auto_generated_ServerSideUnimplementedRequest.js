// --------- This code has been automatically generated !!! 2017-08-28T20:52:52.937Z
"use strict";
/**
 * @module opcua.address_space.types
 */
var assert = require("better-assert");
var util = require("util");
var _  = require("underscore");
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var schema_helpers =  require("node-opcua-factory/src/factories_schema_helpers");
var extract_all_fields                       = schema_helpers.extract_all_fields;
var resolve_schema_field_types               = schema_helpers.resolve_schema_field_types;
var initialize_field                         = schema_helpers.initialize_field;
var initialize_field_array                   = schema_helpers.initialize_field_array;
var check_options_correctness_against_schema = schema_helpers.check_options_correctness_against_schema;
var _defaultTypeMap = require("node-opcua-factory/src/factories_builtin_types")._defaultTypeMap;
var ec = require("node-opcua-basic-types");
var encodeArray = ec.encodeArray;
var decodeArray = ec.decodeArray;
var makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
var generate_new_id = require("node-opcua-factory").generate_new_id;
var _enumerations = require("node-opcua-factory/src/factories_enumerations")._private._enumerations;
var schema = require("../test/test_server_resilience").ServerSideUnimplementedRequest_Schema;
var getFactory = require("node-opcua-factory/src/factories_factories").getFactory;
var RequestHeader = getFactory("RequestHeader");
var BaseUAObject = require("node-opcua-factory/src/factories_baseobject").BaseUAObject;

/**
 * 
 * @class ServerSideUnimplementedRequest
 * @constructor
 * @extends BaseUAObject
 * @param  options {Object}
 * @param  [options.requestHeader] {RequestHeader} 
 */
function ServerSideUnimplementedRequest(options)
{
    options = options || {};
    /* istanbul ignore next */
    if (schema_helpers.doDebug) { check_options_correctness_against_schema(this,schema,options); }
    var self = this;
    assert(this instanceof BaseUAObject); //  ' keyword "new" is required for constructor call')
    resolve_schema_field_types(schema);

    BaseUAObject.call(this,options);

    /**
      * 
      * @property requestHeader
      * @type {RequestHeader}
      */
    self.requestHeader =  new RequestHeader( options.requestHeader);

   // Object.preventExtensions(self);
}
util.inherits(ServerSideUnimplementedRequest,BaseUAObject);
ServerSideUnimplementedRequest.prototype.encodingDefaultBinary = makeExpandedNodeId(892,0);
ServerSideUnimplementedRequest.prototype._schema = schema;

/**
 * encode the object into a binary stream
 * @method encode
 *
 * @param stream {BinaryStream} 
 */
ServerSideUnimplementedRequest.prototype.encode = function(stream,options) {
    // call base class implementation first
    BaseUAObject.prototype.encode.call(this,stream,options);
   this.requestHeader.encode(stream,options);
};
/**
 * decode the object from a binary stream
 * @method decode
 *
 * @param stream {BinaryStream} 
 * @param [option] {object} 
 */
ServerSideUnimplementedRequest.prototype.decode = function(stream,options) {
    // call base class implementation first
    BaseUAObject.prototype.decode.call(this,stream,options);
    this.requestHeader.decode(stream,options);
};
ServerSideUnimplementedRequest.possibleFields = [
  "requestHeader"
];


exports.ServerSideUnimplementedRequest = ServerSideUnimplementedRequest;
var register_class_definition = require("node-opcua-factory/src/factories_factories").register_class_definition;
register_class_definition("ServerSideUnimplementedRequest",ServerSideUnimplementedRequest);
