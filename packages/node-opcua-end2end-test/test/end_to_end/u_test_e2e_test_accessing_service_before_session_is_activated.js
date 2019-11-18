"use strict";
const async = require("async");
/* global describe,it,before,after,beforeEach,afterEach*/

const {
    OPCUAClient,
    ReadRequest,
    TimestampsToReturn,
    StatusCodes
} = require("node-opcua");

module.exports = function(test) {

    let client;
    describe("SNAC Testing client accessing service before session is activated ", function() {

        beforeEach(function(done) {
            client = OPCUAClient.create();
            done();
        });
        afterEach(function(done) {
            client = null;
            done();
        });

        it("SNAC1- should return BadSessionNotActivated when service is called before session is activated", (done) => {

            let session1;
            let last_response;
            async.series([

                function(callback) {
                    client.connect(test.endpointUrl, callback);
                },
                function(callback) {
                    client._createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        session1 = session;
                        callback();
                    });
                },
                // let verify that it is now possible to send a request on client1's session
                function(callback) {
                    // coerce nodeIds
                    const request = new ReadRequest({
                        nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                        maxAge: 0,
                        timestampsToReturn: TimestampsToReturn.Both
                    });
                    request.requestHeader.authenticationToken = session1.authenticationToken;

                    client.performMessageTransaction(request, function(err, response) {
                        console.log(err ? err.toString() : "null");
                        console.log(response ? response.toString() : "null");
                        last_response = response;
                        callback();
                    });
                },
                function(callback) {
                    client.closeSession(session1, true, callback);
                },
                function(callback) {
                    console.log("disconnecting")
                    client.disconnect(callback);
                }
            ], (err) => {
                if (err) {
                    return done(err);
                }
                last_response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionNotActivated);
                done();
            });
        });

    });
}

