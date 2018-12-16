// tslint:disable:no-console
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import { MessageBuilder, messageHeaderToString, MessageSecurityMode, SecurityPolicy } from "../source/index";

/**
 *
 * @param packets
 */
export function verify_multi_chunk_message(packets: any[]) {

    const messageBuilder = new MessageBuilder({});
    messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

    messageBuilder.on("full_message_body", (fullMessageBody: Buffer) => {
        console.log("full_message_body received:");
        analyseExtensionObject(fullMessageBody, 0, 0);
    });
    messageBuilder.on("start_chunk", (info) => {
        console.log(" starting new chunk ", info.messageHeader);
    });

    messageBuilder.on("chunk", (messageChunk) => {
        console.log(messageHeaderToString(messageChunk));
    });

    let totalLength = 0;
    packets.forEach((packet) => {
        if (packet instanceof Array) {
            packet = Buffer.from(packet);
        }
        totalLength += packet.length;
        // console.log(sprintf(" adding packet size : %5d l=%d", packet.length, totalLength));
        messageBuilder.feed(packet);
    });
}

export function verify_single_chunk_message(packet: Buffer) {
    verify_multi_chunk_message([packet]);
}
