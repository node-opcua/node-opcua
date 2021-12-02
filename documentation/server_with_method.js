const { OPCUAServer, DataType, Variant, VariantArrayType, StatusCodes, makeAccessLevelFlag } = require("node-opcua");

(async () => {
    try {
        const server = new OPCUAServer({
            port: 4334 // the port of the listening socket of the server
        });

        await server.initialize();

        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        const myDevice = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "MyDevice"
        });

        const method = namespace.addMethod(myDevice, {
            browseName: "Bark",

            inputArguments: [
                {
                    name: "nbBarks",
                    description: { text: "specifies the number of time I should bark" },
                    dataType: DataType.UInt32
                },
                {
                    name: "volume",
                    description: { text: "specifies the sound volume [0 = quiet ,100 = loud]" },
                    dataType: DataType.UInt32
                }
            ],

            outputArguments: [
                {
                    name: "Barks",
                    description: { text: "the generated barks" },
                    dataType: DataType.String,
                    valueRank: 1
                }
            ]
        });

        // optionally, we can adjust userAccessLevel attribute
        method.outputArguments.userAccessLevel = makeAccessLevelFlag("CurrentRead");
        method.inputArguments.userAccessLevel = makeAccessLevelFlag("CurrentRead");

        method.bindMethod((inputArguments, context) => {
            const nbBarks = inputArguments[0].value;
            const volume = inputArguments[1].value;

            console.log("Hello World ! I will bark ", nbBarks, " times");
            console.log("the requested volume is ", volume, "");
            const sound_volume = Array(volume).join("!");

            const barks = [];
            for (let i = 0; i < nbBarks; i++) {
                barks.push("Whaff" + sound_volume);
            }

            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [
                    {
                        dataType: DataType.String,
                        arrayType: VariantArrayType.Array,
                        value: barks
                    }
                ]
            };
            return callMethodResult;
        });

        await server.start();
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl);
    } catch (err) {
        console.log(err);
    }
})();
