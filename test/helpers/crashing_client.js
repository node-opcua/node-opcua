// a simple client that is design to crash in the middle of a connection
// once a item has been monitored

/*global require,console,setTimeout */
var opcua = require("../../"); // node-opcua
var async = require("async");

var port = process.argv[2];


var endpointUrl = "opc.tcp://" + require("os").hostname() + ":" + port;
console.log("endpointUrl = ",endpointUrl);

var options = {
    requestedSessionTimeout: 101, // very short
    keepSessionAlive: true,
    connectionStrategy: {
        maxRetry: 0,
        initialDelay: 2000,
        maxDelay:     3000,
        randomisationFactor: 0
    }
};

var client = new opcua.OPCUAClient(options);

var the_session, the_subscription;

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
        },

        // step 2 : createSession
        function(callback) {
            client.createSession( function(err,session) {
                if(!err) {
                    the_session = session;
                }
                callback(err);
            });
        },

        // step 3 : browse
        function(callback) {
            setTimeout(function(){
                console.log(" CRASHING !!!!");
                process.exit(-1);
            },3000);
        },
        //
        // function(callback) {
        //
        //     the_subscription=new opcua.ClientSubscription(the_session,{
        //         requestedPublishingInterval: 200,
        //         requestedLifetimeCount:       60,
        //         requestedMaxKeepAliveCount:    10,
        //         maxNotificationsPerPublish: 10,
        //         publishingEnabled: true,
        //         priority: 10
        //     });
        //
        //     the_subscription.on("started",function(){
        //         console.log("subscription started for 10 seconds - subscriptionId=",the_subscription.subscriptionId);
        //     }).on("keepalive",function(){
        //         console.log("keepalive");
        //     }).on("terminated",function(){
        //         console.log("subscription terminated");
        //         callback();
        //     });
        //
        //     setTimeout(function(){
        //         console.log("terminating subscription");
        //         the_subscription.terminate();
        //     },10000);
        //
        //
        //     // install monitored item
        //     var monitoredItem  = the_subscription.monitor({
        //             nodeId: opcua.resolveNodeId("ns=411;s=Scalar_Simulation_Double"),
        //             attributeId: opcua.AttributeIds.Value
        //         },
        //         {
        //             samplingInterval: 100,
        //             discardOldest: true,
        //             queueSize: 10
        //         },
        //         opcua.read_service.TimestampsToReturn.Both,
        //         function done(err) {
        //             console.log("err = ",err);
        //         }
        //     );
        //     console.log("-------------------------------------");
        //
        //     var crash_set = false;
        //     monitoredItem.on("changed",function(dataValue){
        //         console.log(" value = ",dataValue.value.value);
        //
        //         if (!crash_set) {
        //
        //         }
        //
        //     });
        //
        //
        // },
        //

    ],
    function(err) {
        if (err) {
            console.log(" failure ",err);
        } else {
            console.log("done!");
        }
    }) ;
