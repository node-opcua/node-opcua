const {
    CloseSecureChannelRequest
} = require("node-opcua-service-secure-channel");


const { MessageBuilder } = require("..");
const {
    MockServerTransport,
    fakeAcknowledgeMessage
} = require("../dist/test_helpers");

// eslint-disable-next-line import/order
const { openSecureChannelResponse1 } = require("node-opcua-transport/dist/test-fixtures");
describe("test issue with final CLO message", () => {

    it("dealing with CLO message to CloseSecureChannel ", function(done) {

        // Some client CLOse th secure channel by send a close Message that do not have a CloseSecureChannel embeded
        // instead of receiving this:
        //     C L O F
        //     434c4f46390000000a0000000100000002000000020000000100c401000030caddf65e1dd60102000000000000000000000060ea0000000000
        // we will receive this
        //     C L O F
        //     434c4f46180000000c000000010000000f0000000f000000
        const messageBuilder = new MessageBuilder();
        messageBuilder.on("message", (message) => {
            message.should.be.instanceof(CloseSecureChannelRequest);
            done();
        });
        const buffer = Buffer.from("434c4f46180000000c000000010000000f0000000f000000", "hex");

        messageBuilder.feed(buffer);


    });

})