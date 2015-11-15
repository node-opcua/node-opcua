/**
 * List of parsing results for QueryFirst. The size and order of the list matches the size and order of the NodeTypes
 * request parameter. This structure is defined in-line with the following indented items.
 * This list is populated with any status codes that are related to the processing of the node types that are part
 * of the query. The array can be empty if no errors where encountered. If any node type encountered an error all
 * node types shall have an associated status code.
 */

var ParsingResult_Schema = {
    name:"ParsingResult",

    fields: [
        { name: "statusCode", fieldType: "StatusCode",documentation:"Parsing result for the requested NodeTypeDescription"},
    /**
     * List of results for dataToReturn. The size and order of the list matches the size and order of the dataToReturn
     * request parameter. The array can be empty if no errors where encountered.
     */
        { name: "dataStatusCodes", isArray:true, fieldType: "StatusCode"},
    /**
     * List of diagnostic information dataToReturn
     * The size and order of the list matches the size and order of the dataToReturn request parameter. T
     * his list is empty if diagnostics information was not requested in the request header or if no diagnostic
     * information was encountered in processing of the query request.
     */
        { name: "dataDiagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }


    ]
};
exports.ParsingResult_Schema = ParsingResult_Schema;