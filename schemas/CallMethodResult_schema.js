require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var NodeId = require("lib/datamodel/nodeid").NodeId;

/*
 * results []
 * 5.11.2.3
 * CallMethodResult
 *
 */
CallMethodResult_Schema = {
    name: "CallMethodResult",
    documentation: "The result of a Method call.",
    fields: [
    /*
     * statusCode                       StatusCode
     *                                  StatusCode of the Method executed in the server. This
     *                                  StatusCode is set to the Bad_InvalidArgument StatusCode if at
     *                                  least one input argument broke a constraint (e.g. wrong data
     *                                  type, value out of range).
     *                                  This StatusCode is set to a bad StatusCode if the Method
     *                                  execution failed in the server, e.g. based on an exception or an
     *                                  HRESULT.
     */
        { name: "statusCode" , fieldType:"StatusCode", documentation: "The StatusCode of the Method executed in the server." },


    /*
     * inputArgumentResults []          StatusCode
     *                                   List of StatusCodes corresponding to the inputArguments.
     *
     */
        { name: "inputArgumentResults" , fieldType:"StatusCode", isArray:true,documentation: "The list of StatusCodes corresponding to the inputArguments." },

    /*
     * inputArgumentDiagnosticInfos []  DiagnosticInfo
     *                                  List of diagnostic information corresponding to the
     *                                  inputArguments. This list is empty if diagnostics information was
     *                                  not requested in the request header or if no diagnostic
     *                                  information was encountered in processing of the request.
     *
     */
        { name: "inputArgumentDiagnosticInfos" , fieldType:"DiagnosticInfo", isArray:true,documentation: "The list of diagnostic information corresponding to the inputArguments." },
    /*
     * outputArguments []               BaseDataType (ANY)
     *
     *                                  List of output argument values. An empty list indicates that there
     *                                  are no output arguments. The size and order of this list matches
     *                                  the size and order of the output arguments defined by the
     *                                  OutputArguments Property of the Method.
     *                                  The name, a description and the data type of each argument are
     *                                  defined by the Argument structure in each element of the
     *                                  methods OutputArguments Property.
     *
     */
        // todo : the spec is not very clear about the fact that the  outputArguments is a array of Variant ..
        //        => Open a ticket issue at the foundation.
        { name: "outputArguments" , fieldType:"Variant", isArray:true, documentation: "The list of output argument values. " }


    ]
};
exports.CallMethodResult_Schema = CallMethodResult_Schema;