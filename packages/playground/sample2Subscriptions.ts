import chalk from "chalk";

import {
    MessageSecurityMode,
    OPCUAClient,
    SecurityPolicy,
    OPCUAClientOptions,
    ConnectionStrategyOptions,
    Variant,
    AttributeIds,
    ClientSession,
    TimestampsToReturn,
    MonitoringParametersOptions,
    ReadValueId,ReadValueIdLike,
    DataChangeFilter , DataChangeTrigger, DeadbandType,
    EventFilter, EventFilterOptions,
    ClientSubscription, ClientMonitoredItem,
    DataValue

} from "node-opcua-client";

async function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const connectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxRetry: 1,
}
const options: OPCUAClientOptions = {
    applicationName: "HelloSample2",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.None,    
    securityPolicy: SecurityPolicy.None,
    defaultSecureTokenLifetime: 10000,
    keepPendingSessionsOnDisconnect: false
};

const client = OPCUAClient.create(options);

client.on("backoff",(count:number,delay:number)=>{ console.log("backogg ");});

async function test1() 
{
    try {

        await client.connect("opc.tcp://opcuademo.sterfive.com:26543");
           
        const session: ClientSession = await client.createSession({
            password: "password1",
            userName: "user1",
        });

        const subscription = await session.createSubscription2({ 
            requestedLifetimeCount: 100,
            requestedPublishingInterval: 1000,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true,
            maxNotificationsPerPublish: 1000
        });

        subscription.on("raw_notification",(n)=> { console.log(n.toString())});

        const parameters1: MonitoringParametersOptions  = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,
            filter: new  DataChangeFilter({
                trigger: DataChangeTrigger.StatusValueTimestamp,
                deadbandType: DeadbandType.Absolute,
                deadbandValue: 0.1
            })
        };
        const itemToMonitor1: ReadValueIdLike = {
            nodeId: "ns=1;s=FanSpeed",
            attributeId: AttributeIds.Value
        };
        
        const item1 = await subscription.monitor(itemToMonitor1,parameters1,TimestampsToReturn.Both);


        console.log(" Item1 = ",item1.result!.statusCode.toString());
    
        item1.on("changed",(dataValue: DataValue) => {
            console.log(" Value1 has changed : ", dataValue.toString())
        });
        const itemToMonitor2: ReadValueIdLike = {
            nodeId: "i=2258",
            attributeId: AttributeIds.EventNotifier
        };
        const parameters2: MonitoringParametersOptions  = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 0,
            filter: new EventFilter({
                
            })
        };
        // const item2 = subscription.monitor(itemToMonitor2,parameters1,TimestampsToReturn.Both);

        await timeout(20000);

        await subscription.terminate();

        await client.disconnect();
        
        console.log(" Done!");

    } catch (e) {
        // Deal with the fact the chain failed
        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }

}
async function test2() 
{

    console.log("----------------------------------------------------");

    try {

        await client.connect("opc.tcp://opcuademo.sterfive.com:26543");
           
        const session: ClientSession = await client.createSession({
            password: "password1",
            userName: "user1",
        });

        const subscription = ClientSubscription.create(session, { 
            requestedLifetimeCount: 100,
            requestedPublishingInterval: 500,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true,
            maxNotificationsPerPublish: 1000
        });

        subscription.on("error",(err) => { console.log(" Error :",err); });
        subscription.on("keepalive",() => { console.log(" Keep Alive"); });
        
        const parameters1: MonitoringParametersOptions  = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 250,
         };
        const itemToMonitor1: ReadValueIdLike = {
            nodeId: "ns=1;s=PumpSpeed",
            attributeId: AttributeIds.Value
        };
        
        const item1 = ClientMonitoredItem.create(subscription, itemToMonitor1,parameters1,TimestampsToReturn.Both);  
        item1
        .on("changed",(dataValue: DataValue) => {
            console.log(" Value1 has changed : ", dataValue.toString())
        })
        .on("terminated",()=>{ 
            console.log("item1 has been terminated");
        });

        const itemToMonitor2: ReadValueIdLike = {
            nodeId: "ns=1;s=FanSpeed",
            attributeId: AttributeIds.Value
        };
        const item2 = ClientMonitoredItem.create(subscription, itemToMonitor2,parameters1,TimestampsToReturn.Both);  
        item2
        .on("changed",(dataValue: DataValue) => {
            console.log(" Value2 has changed : ", dataValue.toString())
        })
        .on("terminated",()=>{ 
            console.log("item2 has been terminated");
        });


        await timeout(10000);

        await subscription.terminate();

        await client.disconnect();
        
        console.log(" Done!");

    } catch (e) {
        // Deal with the fact the chain failed
        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }

}

(async () => {

  ///  await test1();

  console.log(" ----------- sample2")
    await test2();

})();
