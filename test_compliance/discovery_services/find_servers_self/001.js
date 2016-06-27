var path = "../../../";
var opcua = require(path);

var ApplicationType = opcua.ApplicationType;

var should = require("should");
var assert = require("assert");

function addError( str) {
    console.log("ERROR".red , str.cyan);

}
/*
 The service is expected to succeed
 All operations are expected to succeed */
function checkFindServersValidParameter(servers)
{
    var succeeded = true;
    for( var i=0; i<servers.length; i++)
    {
        var description = servers[i];

        if (description.applicationName.text.length === 0)
        {
            addError( "function checkFindServersValidParameter(): application name (text) is empty." );
            succeeded = false;
        }
        // check that application uri is not empty.
        if (description.applicationUri.length === 0)
        {
            addError( "function checkFindServersValidParameter(): application uri is empty." );
            succeeded = false;
        }
        // check that product uri is not empty.
        if (description.productUri.length === 0)
        {
            addError( "function checkFindServersValidParameter(): product uri is empty." );
            succeeded = false;
        }
        // check that application type is not client.
        if (description.applicationType === ApplicationType.Client)
        {
            addError( "function checkFindServersValidParameter(): application type is client." );
            succeeded = false;
        }
    }
    return succeeded;
}

function describe_on_client(title,options,functor) {


    describe(title,function(){

        var client = null;
        beforeEach(function(done){
            client = new opcua.OPCUAClient();

            client.connect(options.endpointUrl,function(err){

                options.client = client;

                done();
            });
        });

        functor();


        afterEach(function(done){
            client.disconnect(done);
        })
    })
}

/* Description: Invoke FindServers with default parameters. */
exports.register_test = function (options) {

    describe_on_client("#FindServer",options,function(callback){

        it("001 : Invoke FindServers with default parameters",function(done) {

            options.client.findServers(function (err, servers) {

                should(err).eql(null);
                checkFindServersValidParameter(servers).should.eql(true);
                servers.length.should.eql(1, "simple server expect 1");
                done(err);
            });
        });

        it("001 : Invoke FindServers with default parameters",function(done) {

            options.client.findServers(function (err, servers) {

                should(err).eql(null);
                checkFindServersValidParameter(servers).should.eql(true);
                servers.length.should.eql(1, "simple server expect 1");
                done(err);
            });
        });


    });

};
