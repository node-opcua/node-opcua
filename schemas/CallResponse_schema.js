

var CallResponse_Schema = {
    name: "CallResponse",
    documentation: "This Service is used to call (invoke) a list of Methods.",
    fields: [
        // Common response parameters (see 7.27 for ResponseHeader definition).
        {name: "responseHeader", fieldType: "ResponseHeader", documentation: "A standard header included in all responses returned by servers."},

        {name: "results", fieldType: "CallMethodResult" , isArray:true,documentation:"Result for the Method calls." },

        /*
         * diagnosticInfos []               DiagnosticInfo
         *
         *                                  List of diagnostic information for the statusCode of the results.
         *                                  This list is empty if diagnostics information was not requested in
         *                                  the request header or if no diagnostic information was
         *                                  encountered in processing of the request.
         */
        { name: "diagnosticInfos" , fieldType:"DiagnosticInfo", isArray:true, documentation: "The List of diagnostic information for the statusCode of the results." }
    ]
};
exports.CallResponse_Schema = CallResponse_Schema;
