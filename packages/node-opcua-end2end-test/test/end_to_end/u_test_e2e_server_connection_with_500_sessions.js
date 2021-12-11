"use strict";

const async = require("async");
const should = require("should");

const opcua = require("node-opcua");
const chalk = require("chalk");

const doDebug = false;

module.exports = function (test) {
    const MAXSESSIONS = 50;

    function getTick() {
        return Date.now() / 1000.0;
    }

    const connectivity_strategy = {
        maxRetry: 100,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0.5
    };

    let client = null;

    function client_session(data, done) {
        should.exist(client);

        function r(t) {
            return Math.ceil(t * 100) / 100;
        }

        function perform(msg, func, callback) {
            setTimeout(function () {
                if (doDebug) {
                    console.log(msg);
                }
                const t = getTick();
                func(function (err) {
                    if (doDebug) {
                        if (err) {
                            console.log("   ", chalk.red(msg), err.message, r(getTick() - t));
                        } else {
                            console.log("   ", chalk.green(msg), r(getTick() - t));
                        }
                    }
                    return callback(err);
                });
            }, 10);
        }
        function wait(callback) {
            setTimeout(callback, Math.ceil(Math.random() * 10 + 10));
        }

        let the_session;

        async.series(
            [
                //Xx wait,
                // create a session using client1
                perform.bind(null, "create session " + data.index, function (callback) {
                    client.createSession(function (err, session) {
                        the_session = session;
                        if (doDebug) {
                            console.log("session.authenticationToken = ", session.authenticationToken.toString("hex"));
                        }
                        callback(err);
                    });
                }),

                wait,

                perform.bind(null, "closing session " + data.index, function (callback) {
                    the_session.close(function (err) {
                        callback(err);
                    });
                })
            ],
            done
        );
    }

    describe("AAAY Testing " + MAXSESSIONS + " sessions on the same  connection ", function () {
        before(function (done) {
            const options = {
                connectionStrategy: connectivity_strategy,
                requestedSessionTimeout: 100000
            };
            client = opcua.OPCUAClient.create(options);
            const endpointUrl = test.endpointUrl;
            client.on("send_request", function (req) {
                if (doDebug) {
                    console.log(req.constructor.name);
                }
            });
            client.on("receive_response", function (res) {
                if (doDebug) {
                    console.log(res.constructor.name, res.responseHeader.serviceResult.toString());
                }
            });

            client.on("start_reconnection", function (err) {
                if (doDebug) {
                    console.log(chalk.bgWhite.yellow("start_reconnection"));
                }
            });
            client.on("backoff", function (number, delay) {
                if (doDebug) {
                    console.log(chalk.bgWhite.yellow("backoff"), number, delay);
                }
            });

            //xx client.knowsServerEndpoint.should.eql(true);

            client.connect(endpointUrl, function () {
                //xx console.log("AAAA!!!!");
                done();
            });
        });
        after(function (done) {
            client.disconnect(function (err) {
                done(err);
            });
        });
        it("QZQ should be possible to open  many sessions on a single connection", function (done) {
            if (test.server) {
                test.server.maxAllowedSessionNumber = MAXSESSIONS;
            }

            const nb = MAXSESSIONS + 10;
            const q = async.queue(client_session, nb);

            for (let i = 0; i < nb; i++) {
                q.push({ index: i });
            }
            q.drain(() => {
                //xx console.log("done");
                done();
            });
        });
    });
};
