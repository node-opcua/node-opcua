require("requirish")._(module);

var _ = require("underscore");
var assert = require("better-assert");
var NodeId = require("lib/datamodel/nodeid").NodeId;

var _defaultTypeMap = require("lib/misc/factories_builtin_types")._defaultTypeMap;
var encode_NodeId = _defaultTypeMap.NodeId.encode;
var decode_NodeId = _defaultTypeMap.NodeId.decode;
assert(_.isFunction(encode_NodeId));
assert(_.isFunction(decode_NodeId));

var decode_ArgumentList = require("lib/datamodel/argument_list").decode_ArgumentList;
var encode_ArgumentList = require("lib/datamodel/argument_list").encode_ArgumentList;

var CallMethodRequest_Schema = {
    name: "CallMethodRequest",
    fields: [

    /*
     *objectId   The NodeId shall be that of the Object or ObjectType that is the
     *           source of a HasComponent Reference (or subtype of HasComponent Reference)
     *           to the Method specified in methodId.
     *           See Part 3 for a description of Objects and their Methods.
     *
     */
        {
            name: "objectId",
            fieldType: "NodeId",
            documentation: "The NodeId shall be that of the Object or ObjectType that " +
            "is the source of a HasComponent Reference (or subtype of HasComponent Reference) to the Method specified in methodId."
        },
    /*
     *
     *  methodId    NodeId of the Method to invoke.  If the objectId is the NodeId of an Object, it is allowed to use the
     *              NodeId of a Method that is the target of a HasComponent Reference from the ObjectType of the Object.
     *
     */
        {name: "methodId", fieldType: "NodeId", documentation: "The NodeId of the Method to invoke."},
    /*
     * inputArguments List of input argument values. An empty list indicates that there are no input arguments.
     *                The size and order of this list matches the size and order of the input arguments defined
     *                by the input InputArguments Property of the Method.
     *                The name, a description and the data type of each argument are defined by the Argument structure in
     *                each element of the method's InputArguments Property.
     */
        // todo : the spec is not very clear about the fact that the  outputArguments is a array of Variant ..
        //        => Open a ticket issue at the foundation.
        {name: "inputArguments", fieldType: "Variant", isArray: true, documentation: "The list of input argument values."}
    ]

};
exports.CallMethodRequest_Schema = CallMethodRequest_Schema;
