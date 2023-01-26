const should = require("should");
const sinon = require("sinon");
const { PacketAssembler } = require("..");

function makeChunk(msgType, length) {
    const total_length = length + 4 + 1;

    total_length.should.be.greaterThan(0);

    const buf = Buffer.alloc(total_length);

    buf.writeUInt8(msgType.charCodeAt(0), 0);
    buf.writeUInt32LE(total_length, 1);

    for (let i = 0; i < length; i++) {
        buf.writeUInt8(msgType.charCodeAt(0), i + 5);
    }

    return buf;
}

function readChunkHeader(data) {
    const msgType = String.fromCharCode(data.readUInt8(0));
    const length = data.readUInt32LE(1);
    return { length: length, extra: msgType };
}

describe("PacketAssembler", function () {
    
    it("should assemble a single packet", (done) => {
        const packetAssembler = new PacketAssembler({ readChunkFunc: readChunkHeader, minimumSizeInBytes: 5 });
        packetAssembler.on(
            "chunk",
            (chunk) => {
                const info = readChunkHeader(chunk);
                info.length.should.equal(chunk.length);

                done();
            }
        );

        packetAssembler.feed(makeChunk("A", 200));
    });

    it("should assemble a chunk sent over several packets", (done) => {
        const packetAssembler = new PacketAssembler({ readChunkFunc: readChunkHeader, minimumSizeInBytes: 5 });
        packetAssembler.on(
            "chunk",
            (chunk) => {
                const info = readChunkHeader(chunk);
                info.length.should.equal(chunk.length);
                info.length.should.equal(2000 + 5);
                done();
            }
        );

        const chunk1 = makeChunk("A", 2000);

        const packet1 = chunk1.slice(0, 100);
        const packet2 = chunk1.slice(100, 200);
        const packet3 = chunk1.slice(200);

        packetAssembler.feed(packet1);
        packetAssembler.feed(packet2);
        packetAssembler.feed(packet3);
    });

    it("should assemble a chunk sent one byte at a time", () => {
        const packetAssembler = new PacketAssembler({ 
            readChunkFunc: readChunkHeader, 
            minimumSizeInBytes: 5,
            maxChunkCount: 10000
        });
        packetAssembler.on(
            "chunk",
            (chunk) => {
                const info = readChunkHeader(chunk);
                info.length.should.equal(chunk.length);
            }
        );
        const onChunkSpy = sinon.spy();
        const errorSpy = sinon.spy();
        packetAssembler.on("chunk", onChunkSpy);
        packetAssembler.on("error", errorSpy);


        const chunk = makeChunk("A", 200);

        for (let i = 0; i < chunk.length; i++) {
            const single_byte_chunk = chunk.slice(i, i + 1);
            packetAssembler.feed(single_byte_chunk);
        }

        errorSpy.callCount.should.equal(0);
        onChunkSpy.callCount.should.equal(1);

    });

    it("should deal with packets containing data from 2 different chunks", () => {
        let counter = 0;
        
        const packetAssembler = new PacketAssembler({ 
            readChunkFunc: readChunkHeader, 
            minimumSizeInBytes: 5 
        });
        
        packetAssembler.on(
            "chunk",
            (chunk) => {
                const info = readChunkHeader(chunk);
                info.length.should.equal(chunk.length);
                info.length.should.equal(200 + 5);
                counter += 1;
                if (counter === 1) {
                    info.extra.should.equal("A");
                }
                if (counter === 2) {
                    info.extra.should.equal("B");
                }
            }
        );

        const onChunkSpy = sinon.spy();
        const errorSpy = sinon.spy();
        packetAssembler.on("chunk", onChunkSpy);
        packetAssembler.on("error", errorSpy);


        const chunk1 = makeChunk("A", 200);
        const chunk2 = makeChunk("B", 200);

        const packet1 = chunk1.slice(0, 150);
        const packet2_a = chunk1.slice(150);
        const packet2_b = chunk2.slice(0, 150);
        const packet2 = Buffer.concat([packet2_a, packet2_b]);
        const packet3 = chunk2.slice(150);

        packetAssembler.feed(packet1);
        packetAssembler.feed(packet2);
        packetAssembler.feed(packet3);

        errorSpy.callCount.should.equal(0);
        onChunkSpy.callCount.should.equal(2);

    });

    it("limits: max chunk size exceeded", () => {
        const packetAssembler = new PacketAssembler({
            readChunkFunc: readChunkHeader,
            minimumSizeInBytes: 5,
            maxChunkSize: 100
        });

        const onChunkSpy = sinon.spy();
        const errorSpy = sinon.spy();
        packetAssembler.on("chunk", onChunkSpy);
        packetAssembler.on("error", errorSpy);

        let counter = 0;
        packetAssembler.on("chunk", (chunk) => {
            const info = readChunkHeader(chunk);
            info.length.should.equal(chunk.length);
            info.length.should.equal(200 + 5);
            counter += 1;
            if (counter === 1) {
                info.extra.should.equal("A");
            }
            if (counter === 2) {
                info.extra.should.equal("B");
            }
        });
        let errorCount = 0;
        packetAssembler.on("error", (err) => {
            err.message.should.match(/maximum chunk size exceeded/);
            errorCount += 1;
        });
        const chunk1 = makeChunk("A", 200);
        const chunk2 = makeChunk("B", 200);
        packetAssembler.feed(chunk1);
        packetAssembler.feed(chunk2);

        errorCount.should.eql(2);

        onChunkSpy.callCount.should.eql(0);
        errorSpy.callCount.should.eql(2);
    });

});
