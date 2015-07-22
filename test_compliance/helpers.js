var path = "../";
var should = require("should");


//var opcua = require(path);
//global.makeNodeId = opcua.makeNodeId;
//global.DataValue = opcua.DataValue;
//global.DataType = opcua.DataType;
//global.AttributeIds = opcua.AttributeIds;
//global.NumericRange = opcua.NumericRange;
//global.OPCUAClient = opcua.OPCUAClient;
//global.StatusCodes = opcua.StatusCodes;
//global.AccessLevelFlag = opcua.AccessLevelFlag;



var perform_operation_on_client_session = require(path + "test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var supportedType = [
    "Boolean", "Byte", "SByte", "Int16", "UInt16", "Int32", "UInt32",
    "Int64" , "UInt64",
    "Number", "Double", "Float",
    "Integer",
    "NodeId",
    "String", "Guid" , "LocaleId"// ,"Toto"
    // "Variant" ,
];

var ns = 411;

var nodeIdSettings = {
    arraysStatic: supportedType.map(function(type){ return  makeNodeId("Scalar_Static_Array_"  + type, ns); }),
    securityAccess: {
        accessLevelCurrentReadNotCurrentWrite: makeNodeId("AccessLevel_CurrentRead_NotCurrentWrite", ns)
  //      accessLevelCurrentReadNotCurrentWrite: makeNodeId("Scalar_Static_Boolean", ns)
    }
};

global.nodeIdSettings = nodeIdSettings;



function describe_on_session(title, options, callback) {

    describe(title, function () {
        var final_callback = null;
        var after_done = null;

        before(function(done) {

            var client = options.client;
            var endpointUrl = options.endpointUrl;

            perform_operation_on_client_session(client, endpointUrl, function (_session, _final_callback) {
                options.session = _session;
                final_callback = _final_callback;
                done();
            },function() {
                after_done();
            });
        });

        after(function(done){
            after_done = done;
            final_callback();
        });

        callback(options);

    });
}
global.describe_on_session = describe_on_session;
