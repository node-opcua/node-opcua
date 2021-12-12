"use strict";

/// issues: #237 #288
const path = require("path");

const fs = require("fs");

const opcua = require("node-opcua");
const chalk = require("chalk");
const async = require("async");
const  _ = require("underscore");
 
function server_stuff() {
    let server;
    const port = 26543;

    function start_server(callback)
    {
        const server_options = {
            port: port,        
            maxAllowedSessionNumber:  2,
            maxConnectionsPerEndpoint: 2,    
            nodeset_filename: [
                opcua.get_mini_nodeset_filename()
            ],
            isAuditing: false
        };
        server = new opcua.OPCUAServer(server_options);
        server.start(function (err) {
            if (err) {
                console.log(chalk.red(" Server failed to start ... exiting"));
                process.exit(-3);
            }
            console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
        
            callback();
        });
        
    }
    function stop_server(callback)  {

        console.log(chalk.red("---------------------------------- SHUTING DOWN SERVER"));
        server.shutdownChannels(callback);
        if (true) return;

        const chnls = _.values(server._channels);
        chnls.forEach(function(channel){
            if (channel.transport && channel.transport._socket) {
                channel.transport._socket.close();
                channel.transport._socket.destroy();
                channel.transport._socket.emit("error", new Error("EPIPE"));
            }
    
        });
        

        server.shutdown(callback);
    }
    
    const duration1 = 4000;

    async.series([
        start_server,
        function(callback)  {  setTimeout(callback,duration1);},
        stop_server,
        function(callback)  {  setTimeout(callback,duration1);},
        start_server,
        function(callback)  {  setTimeout(callback,duration1);},
        stop_server,
        function(callback)  {  setTimeout(callback,duration1);},
        start_server,
        function(callback)  {  setTimeout(callback,duration1);},
        stop_server,
        function(callback)  {  setTimeout(callback,duration1);},

    ],function() {
        console.log("done");
    })
}
//server_stuff();

const certificateFolder = path.join(__dirname, "../packages/node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

const certificateFile = path.join(certificateFolder, "client_selfsigned_cert_2048.pem");
const privateKeyFile =  path.join(certificateFolder, "client_key_2048.pem");

const client = opcua.OPCUAClient.create({
    endpointMustExist: false,
    keepSessionAlive: true,
    requestedSessionTimeout: 60000,

    certificateFile: certificateFile,
    privateKeyFile: privateKeyFile,

    securityMode: opcua.MessageSecurityMode.SignAndEncrypt,
    securityPolicy: opcua.SecurityPolicy.Basic256,

    connectionStrategy: {
        maxRetry: 10000000,
        initialDelay: 100,
        maxDelay: 1000
    }
});

const endpointUrl = "opc.tcp://" + require("os").hostname() + ":53530/OPCUA/SimulationServer";
const nodeId = opcua.coerceNodeId("ns=3;s=Int32");
const doDebug = true;

let the_session, the_subscription,monitoredItem;


async.series([

    // step 1 : connect to
    function(callback)  {

        client.connect(endpointUrl,function (err) {
            if(err) {
                console.log(" cannot connect to endpoint :" , endpointUrl );
            } else {
                console.log("connected !");
            }
            callback(err);
        });

        client.on("connection_reestablished",function() {
            console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("backoff", function (number, delay) {
            console.log(chalk.bgWhite.yellow("backoff  attempt #"),number, " retrying in ",delay/1000.0," seconds");
        });
    },

    // step 2 : createSession
    function(callback) {
        client.createSession( function(err,session) {
            if(!err) {
                the_session = session;
            }
            console.log("session timeout = ",session.timeout);
            the_session.on("keepalive",function(state) {
                console.log(
                    chalk.yellow("KeepAlive state="),
                    state.toString(),
                    " pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

            });
            the_session.on("session_closed" ,function(statusCode) {
            
                console.log(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");

            });
            callback(err);
        });
    },
    
    function(callback) {
        // create a subscription
 
        const parameters = {
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        };

        the_subscription = opcua.ClientSubscription.create(the_session, parameters);

        function getTick() {
            return Date.now();
        }

        const t = getTick();

        the_subscription.on("started", function () {

            console.log("started subscription :", the_subscription.subscriptionId);

            console.log(" revised parameters ");
            console.log("  revised maxKeepAliveCount  ", the_subscription.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
            console.log("  revised lifetimeCount      ", the_subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
            console.log("  revised publishingInterval ", the_subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
            console.log("  suggested timeout hint     ", the_subscription.publish_engine.timeoutHint);

            callback();

        }).on("internal_error", function (err) {
            console.log(" received internal error", err.message);

        }).on("keepalive", function () {

            const t1 = getTick();
            console.log(chalk.cyan("keepalive "), chalk.cyan(" pending request on server = "), the_subscription.publish_engine.nbPendingPublishRequests);

        }).on("terminated", function (err) {

        });
    
    },

       function client_create_monitoredItem(callback) {

           const result = [];
           const requestedParameters= {
               samplingInterval: 250,
               queueSize: 1,
               discardOldest: true
           };
           const item ={nodeId:nodeId, attributeId: opcua.AttributeIds.Value};

           monitoredItem = opcua.ClientMonitoredItem.create(the_subscription, item,requestedParameters,opcua.TimestampsToReturn.Both,function(err){
               console.log("err",err);
           });
           monitoredItem.on("err",function(errMessage) {
               callback(new Error(errMessage));
            });
           monitoredItem.on("changed",function(dataValue){
               if (doDebug) {
                   console.log(chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"),dataValue.statusCode.toString(),dataValue.value.toString());
               }
               result.push(dataValue);
           });
           monitoredItem.on("initialized", function () {
               if (doDebug) {
                   console.log(" MonitoredItem initialized");
               }
               callback();
           });

       },

    function(callback) {
       
        let counter = 0;

        const intervalId = setInterval(function() {

            console.log(" Session OK ? ", the_session.isChannelValid() ,

                    "session will expired in ", the_session.evaluateRemainingLifetime()/1000, " seconds",

                    chalk.red("subscription will expirer in "),the_subscription.evaluateRemainingLifetime()/1000, " seconds",
                    chalk.red("subscription?"),the_session.subscriptionCount);
            if (!the_session.isChannelValid() && false) {
                //xx console.log(the_session.toString());
                return; // ignore write as session is invalid for the time being
            }


            let nodeToWrite = {
                nodeId: nodeId,
                attributeId: opcua.AttributeIds.Value,
                value: /* DataValue */{
                    statusCode: opcua.StatusCodes.Good,
                    sourceTimestamp: new Date(),
                    value: /* Variant */{
                        dataType: opcua.DataType.Int32,
                        value: counter 
                    }
                }
            };
            the_session.write([nodeToWrite],function(err,statusCode) {
                if(err) {
                    console.log("result",err.message);
                } else {
                    counter += 1;
                    console.log("writing ",counter);
                }
                //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
            });

        },100);

        setTimeout(function(){   
            clearInterval(intervalId);
            callback();
        },200000000);
       
    },
    // close session
    function(callback) {
        the_session.close(function(err){
            if(err) {
                console.log("session closed failed ?");
            }
            callback();
        });
    }

],
function(err) {
    if (err) {
        console.log(" failure ",err);
    } else {
        console.log("done!");
    }
    client.disconnect(function(){});
}) ;
