


var start_simple_server = require("./external_server_fixture").start_simple_server;
var stop_simple_server = require("./external_server_fixture").stop_simple_server;


describe("testing external server operations",function() {

    this.timeout(10000);

    xit("should start and stop a external server",function(done) {

        var serverHandle = null;
        start_simple_server(function(err,data){

            if (!err) {
                serverHandle = data;
                stop_simple_server(serverHandle,function(err){
                    done(err);
                });
            } else {
                done(err);
            }
        });

    });

});