
const { BinaryStream } = require("node-opcua-binary-stream");
const should = require("should");

const { QualifiedName, coerceQualifiedName, encodeQualifiedName, decodeQualifiedName } = require("..");

describe("QualifiedName", () => {

    it("should construct a qualified name", () => {
        const qn = new QualifiedName();
        qn.namespaceIndex.should.eql(0);
        should(qn.name === null).be.equal(true);
        qn.isEmpty().should.eql(true);
        qn.toString().should.eql("<null>");
    });

    it("should construct a qualified name", () => {
        const qn = new QualifiedName({});
        qn.namespaceIndex.should.eql(0);
        should(qn.name === null).be.equal(true);
        qn.isEmpty().should.eql(true);
    });
    it("should construct a qualified name", () => {
        const qn = new QualifiedName({ name: "" });
        qn.namespaceIndex.should.eql(0);
        qn.isEmpty().should.eql(true);
    });
    it("testing qualified name toString", () => {
        const qn = new QualifiedName({ name: "Hello" });
        qn.toString().should.eql("Hello");
    });
    it("testing qualified name toString", () => {
        const qn = new QualifiedName({ namespaceIndex: 2, name: "Hello" });
        qn.toString().should.eql("2:Hello");
    });
    it("should coerce a string into a qualified name ", () => {
        const qn = coerceQualifiedName("Hello");
        qn.toString().should.eql("Hello");
    });
    it("should coerce a qualified name  into a qualified name ", () => {
        const qn = coerceQualifiedName({ namespaceIndex: 0, name: "Hello" });
        qn.toString().should.eql("Hello");
    });
    it("should coerce a null object  into a null qualified name ", () => {
        const qn = coerceQualifiedName();
        should(qn).eql(null);
    });
    it("should coerce a QualifiedNamed", () => {
        const value = new QualifiedName({ namespaceIndex: 2, name: "Hello" });
        const qn = coerceQualifiedName(value);
        qn.toString().should.eql("2:Hello");
    })
    it("QualifiedName#isEmpty", () => {
        const qn = new QualifiedName({});
        qn.isEmpty().should.eql(true);
    });
    it("encodeDecode QualifiedName", () => {

        const stream = new BinaryStream();
        const value = coerceQualifiedName("Hello");
        encodeQualifiedName(value, stream);

        // first form
        stream.rewind();
        const reloaded = decodeQualifiedName(stream);
        reloaded.name.should.eql("Hello");

        // second form
        stream.rewind();
        const reloaded2 = new QualifiedName(null);
        decodeQualifiedName(stream, reloaded2);
        reloaded2.name.should.eql("Hello");

    })
});
