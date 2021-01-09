"use strict";
const should = require("should");
const async = require("async");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");

const { 
  OPCUAClient, 
  StatusCodes, 
  PublishRequest,
  CreateSubscriptionRequest,
  CloseSessionRequest,
  ReadRequest,
  TimestampsToReturn, 
  MessageSecurityMode,
  SecurityPolicy,
  UserNameIdentityToken
} = require("node-opcua");
const {
  readCertificate,
  readCertificateRevocationList
} = require("node-opcua-crypto");

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

function sendPublishRequest(session, callback) {
  const publishRequest = new PublishRequest({});
  session.performMessageTransaction(publishRequest, function(err, response) {
    callback(err, response);
  });
}

function createSubscription(session, callback) {
  const publishingInterval = 1000;
  const createSubscriptionRequest = new CreateSubscriptionRequest({
    requestedPublishingInterval: publishingInterval,
    requestedLifetimeCount: 60,
    requestedMaxKeepAliveCount: 10,
    maxNotificationsPerPublish: 10,
    publishingEnabled: true,
    priority: 6
  });

  session.performMessageTransaction(createSubscriptionRequest, function(err/*, response*/) {
    callback(err);
  });
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

  describe("testing session  transfer to different channel", function() {

    it("RQC1 - It should be possible to close a session that has not be activated yet", function(done) {
      let client1;
      let session1;
      async.series([

        function(callback) {
          client1 = OPCUAClient.create({});
          client1.connect(test.endpointUrl, callback);
        },

        // create a session using client1, without activating it
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },

        function(callback) {

          // Question: ? Should a unactivated session be accounted for
          //             in the currentSessionCount ?
          test.server.engine.currentSessionCount.should.eql(1);

          // however client shall not record session yet
          client1._sessions.length.should.eql(0);

          // in fact, let make sure that close Session is not harmfull
          client1.closeSession(session1, /* deleteSubscriptions =*/true, function(err) {
            client1._sessions.length.should.eql(0);
            if (err) {
              // if treated as a Failure , close session expected to return BadSessionNotActivated
              err.message.match(/BadSessionNotActivated/);
            }
            callback();
          });

        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        },
        function(callback) {
          client1.disconnect(callback);
        }
      ], done);

    });

    it("RQB1 - calling CreateSession and CloseSession &  CloseSession again should return BadSessionIdInvalid", function(done) {
      let client1;
      let session1;
      async.series([

        function(callback) {
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },

        function(callback) {
          session1.close(function() {
            callback();
          });
        },
        function(callback) {
          session1.close(function(err) {
            // now session close do not return error if session in invalid
            // err.message.should.match(/SessionIdInvalid/);
            should.not.exist(err);
            callback();
          });
        },
        //
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          client1.disconnect(callback);
        }

      ], done);

    });

    it("RQB2 - calling CloseSession without calling CreateSession first", function(done) {
      let client1;

      async.series([

        function(callback) {
          client1 = OPCUAClient.create({});
          client1.connect(test.endpointUrl, callback);
        },
        function(callback) {
          const request = new CloseSessionRequest({
            deleteSubscriptions: true
          });
          client1.performMessageTransaction(request, function(err, response) {
            should.not.exist(err);
            //err.message.should.match(/BadSessionIdInvalid/);
            response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionIdInvalid);
            callback();
          });
        },
        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }
      ], done);

    });

    it("RQB3 - calling CreateSession,  CloseSession  and CloseSession again", function(done) {
      let client1;
      let session1;
      async.series([

        function(callback) {
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {
          client1.createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },

        // first call to close session should be OK
        function(callback) {
          client1.closeSession(session1, /* deleteSubscriptions =*/true, function(err) {
            callback(err);
          });
        },

        // second call to close session should raise an error
        function(callback) {
          const request = new CloseSessionRequest({
            deleteSubscriptions: true
          });
          client1.performMessageTransaction(request, function(err, response) {
            should.not.exist(err);
            //err.message.should.match(/BadSessionIdInvalid/);
            response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionIdInvalid);
            callback();
          });
        },

        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], function final(err) {
        client1.disconnect(function() {
          done(err);
        });
      });

    });

    it("RQ0 - call ActiveSession on a session that has been transferred to a different channel", function(done) {

      // this test verifies that the following requirement can be met
      // OpcUA 1.02 part 3 $5.5 Secure Channel Set page 20
      // Once a  Client  has established a  Session  it may wish to access the  Session  from a different
      // SecureChannel. The Client can do this by validating the new  SecureChannel  with the
      // ActivateSession  Service  described in 5.6.3.
      let client1, client2;
      let session1;
      async.series([

        // create a first channel (client1)
        function(callback) {
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },
        // activate the session as expected on same channel used to create it
        function(callback) {
          client1._activateSession(session1, function(err) {
            callback(err);
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
          client1.performMessageTransaction(request, function(err, response) {
            should.not.exist(err);
            response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            callback();
          });
        },

        // create a second channel (client2)
        function(callback) {
          client2 = OPCUAClient.create();
          client2.connect(test.endpointUrl, callback);
        },

        // reactivate session on second channel
        function(callback) {
          client2.reactivateSession(session1, function(err) {
            callback(err);
          });
        },

        // now that session has been assigned to client 1,
        // server shall refuse any requests on channel1
        function(callback) {
          // coerce nodeIds
          const request = new ReadRequest({
            nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both
          });
          request.requestHeader.authenticationToken = session1.authenticationToken;
          client1.performMessageTransaction(request, function(err, response) {
            if (!err) {
              response.responseHeader.serviceResult.should.eql(StatusCodes.BadSecureChannelIdInvalid);
            }
            callback(err);
          });
        },
        // but server shall access request on new channel
        function(callback) {
          // coerce nodeIds
          const request = new ReadRequest({
            nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both
          });
          request.requestHeader.authenticationToken = session1.authenticationToken;
          client2.performMessageTransaction(request, function(err, response) {
            if (!err) {
              response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            }
            callback(err);
          });
        },


        // terminate
        function(callback) {
          client2.disconnect(callback);
        },
        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], done);
    });

    // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
    // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
    // if the  SecureChannel  is not same as the one associated with the CreateSession  request.
    it("RQ1 - should reject if the channel used to activate the session for the first time is not the same as the channel used to create the session", function(done) {

      let client1, client2;
      let session1;

      let initialChannelCount = 0;
      async.series([

        // create a first channel (client1)
        function(callback) {
          initialChannelCount = test.server.getChannels().length;
          test.server.getChannels().length.should.equal(initialChannelCount);
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },

        // create a session using client1
        //   ( without activating it)
        function(callback) {
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            test.server.getChannels().length.should.equal(initialChannelCount + 1);
            callback();
          });
        },
        // create a second channel (client2)
        function(callback) {
          client2 = OPCUAClient.create();
          client2.connect(test.endpointUrl, callback);
        },

        // activate the session created with client1 using client2 !!
        // this should be detected by server and server shall return an error
        function(callback) {
          test.server.getChannels().length.should.equal(initialChannelCount + 2);
          //xx console.log(" ID1 =", client1._secureChannel.channelId);
          //xx console.log(" ID2 =", client2._secureChannel.channelId);

          client2.reactivateSession(session1, function(err) {

            if (!err) {
              callback(new Error("_activateSession shall return an error "));
            }
            err.message.should.match(/BadSessionNotActivated/);
            callback();
          });
        },

        // terminate
        function(callback) {
          client2.disconnect(callback);
        },
        // activate the session as expected on same channel used to create it
        // so we can close it properly
        function(callback) {
          client1._activateSession(session1, function(err) {
            should.not.exist(err);
            session1.close(callback);
          });
        },
        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], done);
    });


    function m(file) {
      const p = path.join(certificateFolder, file);
      if (!fs.existsSync(p)) {
        console.error(" cannot find ", p);
      }
      return p;
    }

    // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
    // Subsequent calls to  ActivateSession  may be associated with different  SecureChannels.  If this is the
    // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
    // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.
    it("RQ2 -server should raise an error if a existing session is reactivated from a channel that have different certificate than the original channel", function(done) {

      const serverCertificate = test.server.getCertificateChain();

      let client1, client2;
      let session1;
      async.series([

        // create a first channel (client1) with
        function(callback) {
          //xx console.log(" creating initial channel with some certificate");
          const certificateFile1 = m("client_cert_2048.pem");
          const privateKeyFile1 = m("client_key_2048.pem");
          console.log(certificateFile1);

          client1 = OPCUAClient.create({
            certificateFile: certificateFile1,
            privateKeyFile: privateKeyFile1,
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
          });

   
          const certificate = readCertificate(certificateFile1);

          async function doIt() {
            await test.server.serverCertificateManager.trustCertificate(certificate);
            const issuerCertificateFile = m("CA/public/cacert.pem");
            const issuerCertificateRevocationListFile = m("CA/crl/revocation_list.der");
            const issuerCertificate = readCertificate(issuerCertificateFile);
            const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
            await test.server.serverCertificateManager.addIssuer(issuerCertificate);
            await test.server.serverCertificateManager.addRevocationList(issuerCrl);
            callback();
          }
          doIt();
        },
        function(callback) {
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {
          //xx console.log(" create session");
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },
        // activate the session as expected on same channel used to create it
        function(callback) {
          //xx console.log(" activate session");
          client1._activateSession(session1, function(err) {
            callback(err);
          });
        },

        // create a second channel (client2)
        // with a different certificate ....
        function(callback) {

          // creating second channel with different credential
          console.log(" creating second channel with different certificate");
          const certificateFile2 = m("client_cert_3072.pem");
          const privateKeyFile2 = m("client_key_3072.pem");
          client2 = OPCUAClient.create({
            certificateFile: certificateFile2,
            privateKeyFile: privateKeyFile2,
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256,
            serverCertificate: serverCertificate
          });
          const certificate = readCertificate(certificateFile2);
          test.server.serverCertificateManager.trustCertificate(certificate, callback);

        },
        function(callback) {
          client2.connect(test.endpointUrl, callback);
        },
        function(callback) {
          // reactivate session on second channel
          // Reactivate should fail because certificate is not the same as the original one
          client2.reactivateSession(session1, function(err) {
            if (err) {
              err.message.should.match(/BadNoValidCertificates/);
              callback();
            } else {
              callback(new Error("expecting reactivateSession to fail"));
            }
          });
        },
        // terminate
        function(callback) {
          client2.disconnect(callback);
        },
        function(callback) {
          session1.close(callback);
        },
        function(callback) {
          client1.disconnect(callback);
        },

        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], done);

    });

    // In addition,the Server shall verify that the  Client  supplied a  UserIdentityToken  that is   identical to the token
    // currently associated with the  Session.
    it("RQ3 - server should raise an error if a session is reactivated with different user identity tokens", function(done) {
      let client1, client2;
      let session1;

      const user1 = {
        userName: "user1", password: "password1"
      };
      const user2 = new UserNameIdentityToken({
        userName: "user1", password: "password1"
      });
      //xx console.log(" user1 ", user1.toString());
      async.series([

        // given a established session with a subscription and some publish request

        function(callback) {
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {

          client1.createSession(user1, function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },
        // when the session is transferred to a different channel
        // create a second channel (client2)
        function(callback) {
          client2 = OPCUAClient.create();
          client2.connect(test.endpointUrl, callback);
        },
        function(callback) {
          // reactivate session on second channel
          // alter session1.userIdentityInfo
          session1.userIdentityInfo = user2;
          session1.userIdentityInfo.userName.should.eql("user1");

          client2.reactivateSession(session1, function(err) {
            err.message.should.match(/BadIdentityChangeNotSupported/);
            _.contains(client1._sessions, session1).should.eql(true);// should have failed
            callback();
          });
        },
        // terminate
        function(callback) {
          client2.disconnect(callback);
        },
        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], done);

    });
    // Once the Server accepts the new  SecureChannel  it shall reject requests sent via the old  SecureChannel.
    xit("RQ4 - server should reject request send via old channel when session has been transferred to new channel", function(done) {
      async.series([], done);
    });

    // unprocessed pending Requests such as PublishRequest shall be be denied by the server
    // Once the Server accepts the new  SecureChannel  it shall reject requests sent via the old  SecureChannel
    it("RQ5 - server should reject pending requests send to old channel when session has been transferred to new channel", function(done) {

      const sinon = require("sinon");

      const collectPublishResponse = sinon.spy();

      let client1, client2;
      let session1;
      async.series([

        // given a established session with a subscription and some publish request

        function(callback) {
          client1 = OPCUAClient.create();
          client1.connect(test.endpointUrl, callback);
        },
        // create a session using client1
        function(callback) {
          client1._createSession(function(err, session) {
            if (err) {
              return callback(err);
            }
            session1 = session;
            callback();
          });
        },
        // activate the session as expected on same channel used to create it
        function(callback) {
          client1._activateSession(session1, function(err) {
            callback(err);
          });
        },

        // creaet a subscription,
        function(callback) {
          createSubscription(session1, callback);
        },


        // when the session is transferred to a different channel
        // create a second channel (client2)
        function(callback) {
          client2 = OPCUAClient.create();
          client2.connect(test.endpointUrl, callback);
          collectPublishResponse.callCount.should.eql(0);
        },

        // provision 3 publish requests and wait for the first keep alive
        function(callback) {

          sendPublishRequest(session1, function(err) {
            should.not.exist(err);
            collectPublishResponse.callCount.should.eql(0);
            callback();
          });
          sendPublishRequest(session1, collectPublishResponse);
          sendPublishRequest(session1, collectPublishResponse);
        },


        function(callback) {
          // reactivate session on second channel
          client2.reactivateSession(session1, function(err) {
            callback(err);
          });
        },
        function(callback) {
          setTimeout(callback, 100);
        },

        function(callback) {

          collectPublishResponse.callCount.should.eql(2);
          collectPublishResponse.getCall(0).args[0].message.should.match(/BadSecureChannelClosed/);
          collectPublishResponse.getCall(1).args[0].message.should.match(/BadSecureChannelClosed/);
          callback();
        },


        // terminate
        function(callback) {
          client2.disconnect(callback);
        },
        function(callback) {
          client1.disconnect(callback);
        },
        function(callback) {
          test.server.engine.currentSessionCount.should.eql(0);
          callback();
        }

      ], done);

    });

  });

};
