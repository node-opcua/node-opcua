"use strict";
/*global describe, it, require*/
var async = require("async");
var should = require("should");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;

var sinon = require("sinon");

module.exports = function (test) {
    
    describe("ZZZB Testing AuditSessionEventType",function() {

        // Auditing for session Set

        // All Services in this Service Set for Servers that support auditing may generate audit entries and shall
        // generate audit Events for both successful and failed Service invocations.
        // These Services shall generate an audit Event of type AuditSessionEventType or a subtype of it.
        // In particular, they shall generate the base EventType or the appropriate subtype, depending on the service
        // that was invoked.
        //
        // The CreateSession service shall generate AuditCreateSessionEventType events or sub-types of it.
        //
        // The ActivateSession service shall generate AuditActivateSessionEventType events or subtypes of it.
        //
        // When the ActivateSession Service is called to change the user identity then the server shall generate
        // AuditActivateSessionEventType events or subtypes of it.
        //
        // The CloseSession service shall generate AuditSessionEventType events or subtypes of it. It shall
        // always be generated if a Session is terminated like SessionTimeout expiration or Server shutdown.
        // The SourceName for Events of this type shall be “Session/Timeout” for a Session timeout,
        // “Session/CloseSession” for a CloseSession Service call and “Session/Terminated” for all other cases.
        //
        //
        // See Part 5 for the detailed assignment of the SourceNode, the SourceName and additional parameters.
        //
        // For the failure case the Message for Events of this type should include a description of why the Service
        // failed. The additional parameters should include the details of the request.
        //
        // This Service Set shall also generate additional audit events in the cases when Certificate validation
        // errors occur. These audit events are generated in addition to the AuditSessionEventTypes. See Part 3 for
        // the definition of AuditCertificateEventType and its subtypes.
        //
        // For Clients, that support auditing, accessing the services in the Session Service Set shall generate
        // audit entries for both successful and failed invocations of the Service. These audit entries should be
        // setup prior to the actual Service invocation, allowing the invocation to contain the correct audit record id.
        var AuditSessionEventTypeNodeIdString = opcua.resolveNodeId("AuditSessionEventType").toString();
        var AuditCreateSessionEventTypeNodeIdString = opcua.resolveNodeId("AuditCreateSessionEventType").toString();
        var AuditActivateSessionEventTypeNodeIdString = opcua.resolveNodeId("AuditActivateSessionEventType").toString();
        var AuditChannelEventTypeNodeIdString = opcua.resolveNodeId("AuditChannelEventType").toString();
        var GeneralModelChangeEventTypeNodeIdString = opcua.resolveNodeId("GeneralModelChangeEventType").toString();

        var auditing_client = null;
        var auditing_session = null;
        var auditing_subscription = null;
        var auditing_monitoredItem = null;
        var isAuditing = false;

        var events_received = [];
        function resetEventLog() {
            events_received = [];
        }
        var fields = ["EventType",  "SourceName", "EventId", "ReceiveTime", "Severity", "Message" , "SessionId"];
        function w(str,l) {
            return (str+ Array(30).join(" ")).substr(0,l);
        }

        function recordEvent(eventFields) {

            var e = {}
            eventFields.forEach(function(eventField,index) {
                e[fields[index]] = eventField;
            });

            Object.keys(e).forEach(function(key)  {
                var value = e[key];
                //xx console.log(w(key,20).yellow,value.toString());
                //,w(eventField.dataType.toString(),15).cyan,eventField.value.toString());
            });
            //xx console.log("");

            events_received.push(e);
        }
        var previous_isAuditing;

        beforeEach(function() {resetEventLog();});

        before(function (done) {

            should.not.exist(auditing_client);
            should.not.exist(auditing_session);

            if (test.server) {
                previous_isAuditing = test.server.engine.isAuditing;
                test.server.engine.isAuditing = true;

                test.nb_backgroundsession+=1;
            }

            var endpointUrl = test.endpointUrl;

            auditing_client = new OPCUAClient({keepSessionAlive: true});

            async.series([
                function (callback) {
                    auditing_client.connect(endpointUrl, callback);
                },
                function (callback) {
                    auditing_client.createSession(function (err, session) {
                        auditing_session = session;
                        callback(err);
                    });
                },
                // create event subscriptions
                function (callback) {
                    auditing_subscription = new opcua.ClientSubscription(auditing_session, {
                        requestedPublishingInterval: 50,
                        requestedLifetimeCount: 10 * 60,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });
                    auditing_subscription.on("started", function () {
                        callback();
                    });
                },
                // monitor
                function (callback) {

                    var eventFilter = opcua.constructEventFilter(fields);

                    var itemToMonitor = {
                        nodeId: opcua.resolveNodeId("Server"),
                        attributeId: opcua.AttributeIds.EventNotifier // << EventNotifier
                    };

                    var requestedParameters = {
                        samplingInterval: 50,
                        discardOldest: true,
                        queueSize: 10,
                        filter: eventFilter
                    };
                    auditing_monitoredItem = auditing_subscription.monitor(itemToMonitor, requestedParameters, opcua.read_service.TimestampsToReturn.Both, function (err) {
                        callback(err);
                    });
                    auditing_monitoredItem.on("changed", function (eventFields) {
                        recordEvent(eventFields);
                    });
                },
                // attempt to set auditing flag
                function (callback) {
                    var nodesToWrite = [
                        {
                            nodeId: opcua.VariableIds.Server_Auditing,
                            attributeId: opcua.AttributeIds.Value,
                            value: /*new DataValue(*/{
                                value: {
                                    /* Variant */
                                    dataType: opcua.DataType.Boolean,
                                    value: true
                                }
                            }
                        }
                    ];
                    auditing_session.write(nodesToWrite,function(err,results){
                        //xx console.log(results);
                        //xx results[0].should.eql(opcua.StatusCodes.Good);
                        callback();
                    });
                },
                // read auditing Flag
                function(callback){
                    var nodesToRead = [{
                        nodeId: opcua.VariableIds.Server_Auditing,
                        attributeId: opcua.AttributeIds.Value
                    }];
                    auditing_session.read(nodesToRead,function(err,unused,dataValues){

                        //xx console.log(" Auditing = ",dataValues[0].toString());
                        isAuditing = dataValues[0].value.value;
                        callback();
                    });
                }
            ], done);
        });
        after(function (done) {

            // restore server as we found it.
            if (test.server) {
                test.server.engine.isAuditing =previous_isAuditing ;
                test.nb_backgroundsession-=1;
            }
            should.exist(auditing_client);
            should.exist(auditing_session);

            async.series([

                function (callback) {
                    auditing_subscription.once("terminated", callback);
                    auditing_subscription.terminate();
                    auditing_subscription = null;
                },
                function (callback) {
                    auditing_session.close(callback);
                    auditing_session = null;
                },
                function (callback) {
                    auditing_client.disconnect(function (err) {
                        auditing_client = null;
                        console.log(" shutting down auditing session");
                        callback(err);
                    });
                }
            ], done);
        });

        it("EdgeCase Session Timeout: server should raise a Session/CreateSession, Session/ActivateSession , Session/Timeout", function (done) {

            var client1 = new OPCUAClient({
                keepSessionAlive: false
            });

            var endpointUrl = test.endpointUrl;
            var the_session;

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout
                    client1.requestedSessionTimeout = 1000;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {

                        //xx console.log("adjusted session timeout =", session.timeout);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },
                function (callback) {
                    setTimeout(callback, 2000);
                },

                function (callback) {
                    the_session.close(function (err) {
                        // session must have timed out on server side
                        err.message.should.match(/BadSessionIdInvalid/);
                        callback(null);
                    });
                },
                function(callback)  {
                    client1.disconnect(function (err) {
                        callback(err);
                    });
                }
                // wait for event to propagate on subscriptions
                ,function(callback) { setTimeout(callback,200); }

            ], function final(err) {

                events_received.length.should.eql(6);

                // Session/CreateSession, Session/ActivateSession , Session/CloseSession

                // "AuditCreateSessionEventType"
                events_received[0].SourceName.value.should.eql("Session/CreateSession");
                events_received[0].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[0].EventType.value.toString().should.eql(AuditCreateSessionEventTypeNodeIdString);

                // "AuditActivateSessionEventType"
                events_received[1].SourceName.value.should.eql("Session/ActivateSession");
                events_received[1].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[1].EventType.value.toString().should.eql(AuditActivateSessionEventTypeNodeIdString);

                // "AuditSessionEventType"
                events_received[2].SourceName.value.should.eql("Session/Timeout");
                events_received[2].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[2].EventType.value.toString().should.eql(AuditSessionEventTypeNodeIdString);

                // "GeneralModelChangeEventType"
                if (false) {

                    events_received[3].SourceName.value.should.eql("Server");
                    events_received[3].EventType.value.toString().should.eql(GeneralModelChangeEventTypeNodeIdString);

                    events_received[4].SourceName.value.should.eql("Server");
                    events_received[4].EventType.value.toString().should.eql(GeneralModelChangeEventTypeNodeIdString);

                    events_received[5].SourceName.value.should.eql("Server");
                    events_received[5].EventType.value.toString().should.eql(GeneralModelChangeEventTypeNodeIdString);
                }


                done(err);
            });

        });
        it("NominalCase: server should raise a Session/CreateSession, Session/ActivateSession , Session/CloseSession", function (done) {

            var client1 = new OPCUAClient({
                keepSessionAlive: true
            });

            var endpointUrl = test.endpointUrl;

            var the_session;

            var keepalive_spy = sinon.spy();

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout
                    client1.requestedSessionTimeout = 1000;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {

                        //xx console.log("adjusted session timeout =", session.timeout);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },
                function (callback) {
                    the_session.close(function (err) {
                        callback(err);
                    });
                },
                function(callback)  {
                    client1.disconnect(function (err) {
                        callback(err);
                    });
                }
                // wait for event to propagate on subscriptions
                ,function(callback) { setTimeout(callback,1000); }

            ], function final(err) {

                events_received.length.should.eql(6);
                // Session/CreateSession, Session/ActivateSession , Session/CloseSession

                //
                // "AuditCreateSessionEventType"
                events_received[0].SourceName.value.should.eql("Session/CreateSession");
                events_received[0].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[0].EventType.value.toString().should.eql(AuditCreateSessionEventTypeNodeIdString);

                // "AuditActivateSessionEventType"
                events_received[1].SourceName.value.should.eql("Session/ActivateSession");
                events_received[1].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[1].EventType.value.toString().should.eql(AuditActivateSessionEventTypeNodeIdString);

                // "AuditSessionEventType"
                events_received[2].SourceName.value.should.eql("Session/CloseSession");
                events_received[2].SessionId.value.toString().should.eql(the_session.sessionId.toString());
                events_received[2].EventType.value.toString().should.eql(AuditSessionEventTypeNodeIdString);

                done(err);
            });
        });
    });
};
