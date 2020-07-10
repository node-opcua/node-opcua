"use strict";
const should = require("should");
const assert = require("node-opcua-assert").assert;
const async = require("async");
const _ = require("underscore");


const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const OPCUAServer = opcua.OPCUAServer;

const context = opcua.SessionContext.defaultContext;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const makeBoiler = require("node-opcua-address-space").makeBoiler;


const doDebug = false;

const UAProxyManager = require("node-opcua-client-proxy").UAProxyManager;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing monitoring Executable flags on methods", function() {


    this.timeout(Math.max(60000, this._timeout));

    let server, client, endpointUrl;

    let boiler_on_server;
    let port = 20000;
    before(function(done) {
        port += 1;

        const options = { port: port };
        server = new OPCUAServer(options);

        server.on("post_initialize", function() {
            boiler_on_server = makeBoiler(server.engine.addressSpace, { browseName: "Boiler#1" });

            const haltMethod = boiler_on_server.simulation.getMethodByName("Halt");
            const resetMethod = boiler_on_server.simulation.getMethodByName("Reset");
            const startMethod = boiler_on_server.simulation.getMethodByName("Start");
            const suspendMethod = boiler_on_server.simulation.getMethodByName("Suspend");
            haltMethod.getExecutableFlag(context).should.eql(true);
            resetMethod.getExecutableFlag(context).should.eql(false);
            startMethod.getExecutableFlag(context).should.eql(true);
            suspendMethod.getExecutableFlag(context).should.eql(false);


            boiler_on_server = boiler_on_server.nodeId;
        });
        server.start(function(err) {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            if (err) {
                return done(err);
            }
            done();
        });
    });

    beforeEach(function(done) {
        client = OPCUAClient.create();
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(done);
    });


    it("#187 ...... ", function(done) {

        let proxyManager;

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            proxyManager = new UAProxyManager(session);
            const nodeId = boiler_on_server;


            let boiler;
            async.series([

                function(callback) {
                    proxyManager.start(callback);
                },

                function(callback) {
                    //xx var smType = "BoilerStateMachineType";
                    const smType = "ProgramStateMachineType";
                    proxyManager.getStateMachineType(smType, function(err, obj) {

                        if (!err) {

                            if (doDebug) {
                                console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");
                                console.log("States       = ", obj.states.map(function(state) {
                                    return state.browseName.toString();
                                }));
                                console.log("Transitions  = ", obj.transitions.map(function(transition) {
                                    return transition.browseName.toString();
                                }));
                            }

                        }
                        callback(err);
                    });
                },
                function(callback) {

                    if (doDebug) {
                        console.log(" NodeId = ", nodeId.toString());
                    }
                    proxyManager.getObject(nodeId, function(err, data) {
                        if (!err) {

                            boiler = data;
                            //xx console.log("xXXXXX",hvac);

                            if (doDebug) {
                                console.log("Current State", boiler.simulation.currentState.toString());
                            }
                            boiler.simulation.currentState.readValue(function(err, value) {
                                if (doDebug) {
                                    console.log(" Interior temperature updated ...", value.toString());
                                }
                                callback(err);
                            });

                            return;
                        }
                        callback(err);
                    });
                },
                function(callback) {
                    boiler.simulation.halt([], function(err) {
                        if (doDebug) {
                            console.log(" HALT => ", err);
                        }
                        callback();
                    });
                },
                function(callback) {
                    boiler.simulation.reset([], function(err) {
                        if (doDebug) {
                            console.log(" Reset => ", err);
                        }
                        callback();
                    });
                },

                function(callback) {
                    setTimeout(callback, 500);
                },

                function(callback) {
                    boiler.simulation.currentState.dataValue.value.value.text.should.eql("Ready");

                    boiler.simulation.$methods["start"].executableFlag.should.eql(true, "When system is Ready, start method shall be executable");
                    boiler.simulation.$methods["suspend"].executableFlag.should.eql(false, "When system is Ready, suspend method shall not be executable");
                    boiler.simulation.$methods["resume"].executableFlag.should.eql(true, "When system is Ready , start method shall be executable");


                    if (doDebug) {
                        console.log(chalk.bgWhite.cyan("    ====================================================================== STARTING .... "));
                    }
                    boiler.simulation.start([], function(err) {
                        if (doDebug) {
                            console.log(" start => ", err);
                        }
                        callback();
                    });
                },

                function(callback) {
                    setTimeout(callback, 500);
                },

                function(callback) {
                    if (doDebug) {
                        console.log(chalk.bgWhite.cyan("    ====================================================================== STARTED .... "));
                    }

                    boiler.simulation.currentState.dataValue.value.value.text.should.eql("Running");
                    boiler.simulation.$methods["start"].executableFlag.should.eql(false, "when system is Running, start method shall NOT be executable");
                    boiler.simulation.$methods["suspend"].executableFlag.should.eql(true, "when system is Running, suspend method shall be executable");
                    boiler.simulation.$methods["resume"].executableFlag.should.eql(false, "when system is Running, resume method shall NOT be executable");

                    boiler.simulation.suspend([], function(err) {
                        if (doDebug) {
                            console.log(" start => ", err);
                        }
                        callback();
                    });
                },

                function(callback) {
                    proxyManager.stop(callback);
                }

            ], inner_done);

        }, done);
    });
});