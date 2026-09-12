const { OPCUAClient, AttributeIds, VariableIds } = require("node-opcua");

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

async function main() {
    try {
        const client = OPCUAClient.create({
            clientName: "MyClient-Hello",
            endpointMustExist: false
        });
        client.on("backoff", (count, delay) => {
            console.log("still trying to connect attempt #", count, " - will try again in ", delay, "ms");
        });

        const { currentSessionCount, currentTime, cummulatedSessionCount, startTime } = await client.withSessionAsync(
            endpointUrl,
            async (session) => {
                console.log("Connected !");
                const dataValue1 = await session.read({
                    attributeIds: AttributeIds.Value,
                    nodeId: VariableIds.Server_ServerStatus_CurrentTime
                });

                const dataValue2 = await session.read({
                    attributeIds: AttributeIds.Value,
                    nodeId: VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount
                });

                const dataValue3 = await session.read({
                    attributeIds: AttributeIds.Value,
                    nodeId: VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount
                });

                const dataValue4 = await session.read({
                    attributeIds: AttributeIds.Value,
                    nodeId: VariableIds.Server_ServerStatus_StartTime
                });

                const currentTime = dataValue1.value.value;
                const currentSessionCount = dataValue2.value.value;
                const cummulatedSessionCount = dataValue3.value.value;
                const startTime = dataValue4.value.value;

                return { currentSessionCount, currentTime, cummulatedSessionCount, startTime };
            }
        );

        console.log("startTime              = ", startTime.toUTCString());
        console.log("Time at server is      = ", currentTime.toUTCString());
        console.log("Current Session count  = ", currentSessionCount);
        console.log("cummulatedSessionCount = ", cummulatedSessionCount);
    } catch (err) {
        console.log(err);
    }
}
main();
