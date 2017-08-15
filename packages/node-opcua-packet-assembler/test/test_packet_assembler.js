var PacketAssembler = require("..").PacketAssembler;
var should = require("should");

function makeMessage(msgType, length) {

    var total_length = length + 4 + 1;

    total_length.should.be.greaterThan(0);

    var buf = new Buffer(total_length);

    buf.writeUInt8(msgType.charCodeAt(0), 0);
    buf.writeUInt32LE(total_length, 1);

    for (var i = 0; i < length; i++) {
        buf.writeUInt8(msgType.charCodeAt(0), i + 5);
    }

    return buf;
}
function readerHeader(data) {
    var msgType = String.fromCharCode(data.readUInt8(0));
    var length = data.readUInt32LE(1);
    return {length: length, extra: msgType};
}


describe("PacketAssembler", function () {

    it("should assemble a single packet", function (done) {


        var packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                var info = readerHeader(message);
                info.length.should.equal(message.length);

                done();
            });

        packet_assembler.feed(makeMessage("A", 200));

    });


    it("should assemble a message sent over several packets", function (done) {

        var packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                var info = readerHeader(message);
                info.length.should.equal(message.length);
                info.length.should.equal(2000 + 5);
                done();
            });

        var message1 = makeMessage("A", 2000);

        var packet1 = message1.slice(0, 100);
        var packet2 = message1.slice(100, 200);
        var packet3 = message1.slice(200);

        packet_assembler.feed(packet1);
        packet_assembler.feed(packet2);
        packet_assembler.feed(packet3);

    });

    it("should assemble a message sent one byte at a time", function (done) {

        var packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                var info = readerHeader(message);
                info.length.should.equal(message.length);

                done();
            });

        var message = makeMessage("A", 200);

        for (var i = 0; i < message.length; i++) {
            var single_byte_chunk = message.slice(i, i + 1);
            packet_assembler.feed(single_byte_chunk);
        }

    });

    it("should deal with packets containing data from 2 different messages", function (done) {

        var counter = 0;
        var packet_assembler = new PacketAssembler({readMessageFunc: readerHeader, minimumSizeInBytes: 5})
            .on("message", function (message) {

                var info = readerHeader(message);
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

        var message1 = makeMessage("A", 200);
        var message2 = makeMessage("B", 200);

        var packet1 = message1.slice(0, 150);
        var packet2_a = message1.slice(150);
        var packet2_b = message2.slice(0, 150);
        var packet2 = Buffer.concat([packet2_a, packet2_b]);
        var packet3 = message2.slice(150);

        packet_assembler.feed(packet1);
        packet_assembler.feed(packet2);
        packet_assembler.feed(packet3);

    });

});
