// tslint:disable:no-console
// tslint:disable:object-literal-sort-keys
// tslint:disable:unused-var
import {
    ActivateSessionRequest,
    BrowseRequest,
    BrowseResponse,
    OPCUAServer,
    RegisterServerMethod,
    Request,
    Response,
    makeBoiler
} from "node-opcua";
async function main() {
    try {
        const server = new OPCUAServer({
            registerServerMethod: RegisterServerMethod.LDS
        });

        await server.initialize();

        server.on("request", (request: Request) => {
            console.log(request.constructor.name, request.requestHeader.requestHandle);

            // you can either check the instance of the request object directl
            if (request instanceof BrowseRequest) {
                console.log("BrowseRequest.requestedMaxReferencesPerNode=", request.requestedMaxReferencesPerNode);
            } else if (request instanceof ActivateSessionRequest) {
                console.log(request.toString());
            }

            // ... or check its schema name
            switch (request.schema.name) {
                case "BrowseRequest": {
                    const browseRequest = request as BrowseRequest;
                    break;
                }
                // etc...
            }
        });
        server.on("response", (response: Response) => {
            // you can either check the instance of the request object directl
            if (response instanceof BrowseResponse) {
                console.log("BrowseResponse.results.length =", response.results ? response.results.length : 0);
            }

            switch (response.schema.name) {
                case "BrowseResponse": {
                    const browseRequest = response as BrowseResponse;
                    console.log("BrowseResponse.results.length =", browseRequest.results ? browseRequest.results.length : 0);
                    break;
                }
                // etc...
            }
        });
        // post-initialize
        const addressSpace = server.engine.addressSpace!;

        addressSpace.installAlarmsAndConditionsService();
        const namespace = addressSpace.getOwnNamespace();

        const myEventType = namespace.addEventType({
            browseName: "MyEventType",
            subtypeOf: "TransitionEventType"
        });

        const HVACModuleType = namespace.addObjectType({
            browseName: "HVACModuleType"
        });

        namespace.addAnalogDataItem({
            modellingRule: "Mandatory",
            componentOf: HVACModuleType,
            browseName: "TargetTemperature",
            minimumSamplingInterval: 0, // could be event Based
            dataType: "Double",
            instrumentRange: { low: -70, high: 120 },
            engineeringUnitsRange: { low: -100, high: 200 }
        });

        namespace.addObject({
            browseName: "Test",
            eventNotifier: 0,
            organizedBy: addressSpace.rootFolder.objects
        });

        const boiler1 = makeBoiler(addressSpace, {
            browseName: "Boiler1",
            organizedBy: addressSpace.rootFolder.objects
        });

        await server.start();
        console.log(" Server started ", server.getEndpointUrl());
    } catch (err) {
        if (err instanceof Error) {
            console.log("Error : ", err.message);
            console.log(err.stack);
        }
    }
}

main();
