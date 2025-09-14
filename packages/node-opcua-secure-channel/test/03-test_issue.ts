import "should";
import { CloseSecureChannelRequest, MessageSecurityMode } from "node-opcua-service-secure-channel";
import { hexDump } from "node-opcua-debug";
import { MessageBuilder, IDerivedKeyProvider, SecurityPolicy } from "../dist/source";

describe("test issue with final CLO message", () => {
    const derivedKeyProvider: IDerivedKeyProvider = {
        getDerivedKey(tokenId: 0) {
            return null;
        }
    };
    it("dealing with CLO message to CloseSecureChannel ", (done) => {
        // Some client CLOse the secure channel by send a close Message that do not have a CloseSecureChannel embedded
        // instead of receiving this:
        //     C L O F
        //     434c4f46390000000a0000000100000002000000020000000100c401000030caddf65e1dd60102000000000000000000000060ea0000000000
        // we will receive this
        //     C L O F
        //     434c4f46180000000c000000010000000f0000000f000000
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {name: "MessageBuilder"});
        messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        messageBuilder.on("message", (message) => {
            message.should.be.instanceof(CloseSecureChannelRequest);
            done();
        });
        messageBuilder.on("full_message_body", (full_message_body) => {
            console.log("full_message_body", hexDump(full_message_body));
        });
        const buffer = Buffer.from("434c4f46180000000c000000010000000f0000000f000000", "hex");
        console.log(hexDump(buffer));

        messageBuilder.feed(buffer);
    });
});
