
import { DataType, nodesets, OPCUAServer, Variant } from "node-opcua"


async function main() {


    const server = new OPCUAServer({

        port: 4840,
        nodeset_filename: [nodesets.standard]

    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;


    addressSpace.isFrugal = true;

    const namespace = addressSpace.getOwnNamespace();

    const uaTestPoint = namespace.addObject({
        browseName: "TestPoint",
        organizedBy: addressSpace.rootFolder.objects.server
    });

    process.once("SIGINT", () => process.exit(1));

    const startDate = Date.now();

    const dataTypeDouble = addressSpace.findDataType("Double")!;

    (addressSpace as any).modelChangeTransaction(() => {
        for (var i = 0; i < 100000; i++) {

            (i % 1000 == 0) && console.log("i", i);
            //console.log("i = ", i);
            const uaVariable = namespace.addVariable({
                // organizedBy: uaTestPoint,
                componentOf: uaTestPoint, // use component 
                browseName: "point_" + i,
                // not needed nodeId: "ns=1;s=testpoint/point_" + i,
                dataType: dataTypeDouble,
                value: new Variant({ dataType: DataType.Double, value: 1000.0 })
            });

            const uaVerif = uaTestPoint.getChildByName("point_" + i);
            if (!uaVerif) {
                throw new Error("Something goes wrong!");
            }
/*
            uaTestPoint.addReference({
                nodeId: uaVariable,
                referenceType: "HasComponent",
                isForward: true
            });
*/
        }
    });
    const endDate = Date.now();

    console.log("Duration  = ", endDate - startDate);


    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log("port ", server.endpoints[0].port);

    await new Promise<void>((resolve) => process.once("SIGINT", resolve));
    await server.shutdown();

}
main();
