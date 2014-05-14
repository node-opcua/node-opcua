var OPCUAClient = require("../lib/client/opcua_client").OPCUAClient;

var assert = require('better-assert');
var async = require("async");
var should = require('should');
var build_server_with_temperature_device = require("./utils/build_server_with_temperature_device").build_server_with_temperature_device;

var s = require("../lib/datamodel/structures");


describe("testing Client-Server with UserName/Password identity token",function() {
    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2001;
    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port+=1;
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });
    it("should connect to a server with username/password authentication",function(done){

        var username = "username";
        var password = "p@ssw0rd";
        var the_session;


        async.series([

            // connect
            function(callback) { client.connect(endpointUrl,callback); },

            // create session
            function(callback) {

                var userIdentityToken = new s.UserNameIdentityToken({
                    policyId: "...",
                    userName: username,
                    password: password,
                    encryptionAlgorithm: "..."
                });

                client.createSession(userIdentityToken,function (err,session){
                    if (!err) {
                        the_session = session;
                    }
                    callback(err);
                });
            },


            // closing session
            function(callback) { the_session.close(function(err){ callback(err); }); },

            // disconnect
            function(callback) { client.disconnect(function() {  callback(); }); }

        ],done);

    });

});
