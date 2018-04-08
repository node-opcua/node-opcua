const PacketAssembler = require("..").PacketAssembler;
const should = require("should");

function makeMessage(msgType, length) {

    const total_length = length + 4 + 1;

    total_length.should.be.greaterThan(0);

    const buf = new Buffer(total_length);

    buf.writeUInt8(msgType.charCodeAt(0), 0);
    buf.writeUInt32LE(total_length, 1);

    for (let i = 0; i < length; i++) {
        buf.writeUInt8(msgType.charCodeAt(0), i + 5);
    }

    return buf;
}
function readerHeader(data) {
    const msgType = String.fromCharCode(data.readUInt8(0));
    const length = data.readUInt32LE(1);
    return {length: length, extra: msgType};
}


describe("PacketAssembler", function () {

    it("should assemble a single packet", function (done) {


        const packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                const info = readerHeader(message);
                info.length.should.equal(message.length);

                done();
            });

        packet_assembler.feed(makeMessage("A", 200));

    });


    it("should assemble a message sent over several packets", function (done) {

        const packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                const info = readerHeader(message);
                info.length.should.equal(message.length);
                info.length.should.equal(2000 + 5);
                done();
            });

        const message1 = makeMessage("A", 2000);

        const packet1 = message1.slice(0, 100);
        const packet2 = message1.slice(100, 200);
        const packet3 = message1.slice(200);

        packet_assembler.feed(packet1);
        packet_assembler.feed(packet2);
        packet_assembler.feed(packet3);

    });

    it("should assemble a message sent one byte at a time", function (done) {

        const packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                const info = readerHeader(message);
                info.length.should.equal(message.length);

                done();
            });

        const message = makeMessage("A", 200);

        for (let i = 0; i < message.length; i++) {
            const single_byte_chunk = message.slice(i, i + 1);
            packet_assembler.feed(single_byte_chunk);
        }

    });

    it("should deal with packets containing data from 2 different messages", function (done) {

        let counter = 0;
        const packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                const info = readerHeader(message);
                info.length.should.equal(message.length);
                info.length.should.equal(200 + 5);
                counter += 1;
                if (counter === 1) {
                    info.extra.should.equal("A");
                }
                if (counter === 2) {
                    info.extra.should.equal("B");
                    done();
                }
            });

        const message1 = makeMessage("A", 200);
        const message2 = makeMessage("B", 200);

        const packet1 = message1.slice(0, 150);
        const packet2_a = message1.slice(150);
        const packet2_b = message2.slice(0, 150);
        const packet2 = Buffer.concat([packet2_a, packet2_b]);
        const packet3 = message2.slice(150);

        packet_assembler.feed(packet1);
        packet_assembler.feed(packet2);
        packet_assembler.feed(packet3);

    });

});
