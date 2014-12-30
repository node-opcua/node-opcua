require("requirish")._(module);

var OPCUAClient  = require("lib/client/opcua_client").OPCUAClient;
var MockTransport = require("./mocks/mock_transport").MockTransport;
var async  = require("async");
var m = require("./mocks/mock_transport");
var opcua = require("lib/nodeopcua");

/*
 * this test verifies that the OPCUA Client  behaves correctly
 * Server responses are emulated using a mock object.
 *
 */
describe("OPCUA-CLIENT",function(){



    it("should connect and disconnect",function(done){
        done();
    });

});