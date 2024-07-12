import { types } from "util";
process.env.NODEOPCUADEBUG = process.env.NODEOPCUADEBUG || "SERVER{TRACE}PERF";
import {
    DataType,
    OPCUACertificateManager,
    OPCUAServer,
    ServerSecureChannelLayer,
} from "node-opcua";
async function main() {
    try {

        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: "./certificates",
        });
        await serverCertificateManager.initialize();
        const server = new OPCUAServer({
            port: 25000,
            serverCertificateManager
        });


        const delay = parseInt(process.env.DELAY || "1000", 10);

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        server.on("newChannel", (channel: ServerSecureChannelLayer) => {

            channel.beforeHandleOpenSecureChannelRequest = async () => {
                console.log("simulating delay in opening channel", delay);
                await wait(delay);
                console.log("simulating delay in opening channel");
             };

        });


        await server.initialize();
        console.log("certificate", server.certificateFile);

        // post-initialize
        const addressSpace = server.engine.addressSpace!;

        addressSpace.installAlarmsAndConditionsService();
        const namespace = addressSpace.getOwnNamespace();

        const myObject = namespace.addObjectType({
            browseName: "MyObject",
            componentOf: addressSpace.rootFolder.objects
        });

        namespace.addAnalogDataItem({
            modellingRule: "Mandatory",
            nodeId: "s=Temperature",
            componentOf: myObject,
            browseName: "Temperature",
            minimumSamplingInterval: 0, // could be event Based
            dataType: "Double",
            instrumentRange: { low: -70, high: 120 },
            engineeringUnitsRange: { low: -100, high: 200 }
        });

        namespace.addVariable({
            nodeId: "s=TargetTemperature",
            browseName: "TargetTemperature",
            componentOf: myObject,
            dataType: "Double",
            value: {
                dataType: DataType.Double,
                value: 0,
            }
        })
        await server.start();
        console.log(" Server started ", server.getEndpointUrl());
    } catch (err) {
        if (types.isNativeError(err)) {
            console.log("Error : ", err.message);
            console.log(err.stack);
        }
    }
}

main();
