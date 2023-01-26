import {
    installAlarmMonitoring,
    OPCUAClient, uninstallAlarmMonitoring, UserIdentityInfoUserName, UserTokenType,
} from "node-opcua";


const endpointUrl = "opc.tcp://localhost:48010";
const doDebug = true;

(async ()=>{

    try {
        const client = OPCUAClient.create({
            endpointMustExist: false,
        });
        client.on("backoff",()=>{
            console.log("backoff");
        })
        const subscriptionParameters = {};
        const connectionParameters = {
            endpointUrl,
            userIdentity: <UserIdentityInfoUserName>{
                type: UserTokenType.UserName,
                password: "secret",
                userName: "root"
            }
        }
        
        const alarms= await client.withSubscriptionAsync(connectionParameters, subscriptionParameters, async (session, _subscription)=>{

            console.log("connected");
            console.log(client.toString());

            const alarmList = await installAlarmMonitoring(session);
            
            alarmList.on("newAlarm", (alarm) => {
                /** */
                console.log(alarm.toString());
                /** */
            });
            alarmList.on("alarmChanged", (alarm) => {
                /** */
                console.log(alarm.toString());
            });

            await new Promise((resolve) =>  process.once("SIGINT",resolve));

            const alarms = alarmList.alarms();
            await uninstallAlarmMonitoring(session);

            return alarms;

        });
        return alarms;
    } catch(err) {
        console.log(err);
        throw err;
    }
})();