import { ClientSecureChannelLayer, OPCUAClient, SecurityHeader } from "node-opcua";


interface OPCUAClientEx extends OPCUAClient {
    _secureChannel: ClientSecureChannelLayer;
}
export  function t(test: any) {
    describe("GGH1 Server should check channelId correctness", function () {
        it("server should abruptly stops the connection if client uses wrong channel Id", async () => {
            const client = OPCUAClient.create({
                defaultTransactionTimeout: 100000
            });

            client.on("secure_channel_created", (channel) => {
                channel.on("send_request",  (
                    request: Request,
                    msgType: string, securityHeader: SecurityHeader) => {
                    console.log(
                        " sending",
                        "channelId=",
                        channel.channelId,
                        request.constructor.name,
                        request.toString(),
                        securityHeader.toString()
                    );
                });
            });
            const endpointUrl = test.endpointUrl;

            await client.connect(endpointUrl);
            
            const clientEx = client as OPCUAClientEx;

            const result1 = await client.getEndpoints({});

            if (!(clientEx._secureChannel instanceof ClientSecureChannelLayer)) {
                throw new Error("expecting a secure channel");
            }
            if (typeof clientEx._secureChannel.channelId !== "number") {
                throw new Error("expecting a channelId");
            }
            clientEx._secureChannel.channelId.should.be.above(0);

            //
            const oldChannelId = clientEx._secureChannel.channelId;

            // lets alter channelId
            const secureChannel = clientEx._secureChannel;
            secureChannel.channelId = 9999;

            let errorHasBeenCaught = false;
            try {
                const result2 = await client.getEndpoints({});
            } catch (err) {
                console.log("err = ", (err as Error).message);
                errorHasBeenCaught = true;
            }

            // lets restore channelId
            secureChannel.channelId = oldChannelId;

            await client.disconnect();

            errorHasBeenCaught.should.eql(true, "server must raise an error if channel is invalid");
        });
    });
};
