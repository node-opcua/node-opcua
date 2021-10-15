const should = require("should");
const { BinaryStream } = require("node-opcua-binary-stream");
const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");
const { LocalizedText, coerceLocalizedText, decodeLocalizedText, encodeLocalizedText } = require("..");

describe("LocalizedText", () => {
    it("should create a LocalizeText", () => {
        const localizedText = new LocalizedText({ text: "HelloWorld", locale: "en-US" });
        localizedText.should.have.property("text");
        localizedText.should.have.property("locale");
        localizedText.text.should.equal("HelloWorld");
        localizedText.locale.should.equal("en-US");
    });

    it("should encode and decode a LocalizeText that have both text and locale", () => {
        const localizedText = new LocalizedText({ text: "HelloWorld", locale: "en-US" });

        const stream = new BinaryStream();
        stream.length.should.equal(0);

        localizedText.encode(stream);

        stream.length.should.be.greaterThan(0);

        const localizedText_check = new LocalizedText();

        stream.rewind();
        localizedText_check.decode(stream);

        localizedText_check.should.eql(localizedText);
        localizedText_check.text.should.equal("HelloWorld");
        localizedText_check.locale.should.equal("en-US");
    });

    it("should encode and decode a LocalizeText that have text but no locale", () => {
        const localizedText = new LocalizedText({ text: "HelloWorld", locale: null });

        localizedText.should.have.property("locale");
        should.not.exist(localizedText.locale);

        const stream = new BinaryStream();
        stream.length.should.equal(0);

        localizedText.encode(stream);

        stream.length.should.be.greaterThan(0);

        const localizedText_check = new LocalizedText();

        stream.rewind();
        localizedText_check.decode(stream);

        localizedText_check.text.should.equal("HelloWorld");
        should.not.exist(localizedText_check.locale);
    });

    it("should encode and decode a LocalizeText that have no text but a locale", () => {
        const localizedText = new LocalizedText({ text: null, locale: "en-US" });

        localizedText.should.have.property("text");
        should.not.exist(localizedText.text);

        const stream = new BinaryStream();
        stream.length.should.equal(0);

        localizedText.encode(stream);

        stream.length.should.be.greaterThan(0);

        const localizedText_check = new LocalizedText();

        stream.rewind();
        localizedText_check.decode(stream);

        localizedText_check.should.eql(localizedText);
        localizedText_check.locale.should.equal("en-US");
        localizedText_check.should.have.property("text");
        should.not.exist(localizedText_check.text);
    });

    it("#coerceLocalizedText - null", () => {
        should.not.exist(coerceLocalizedText(null));
    });
    it("#coerceLocalizedText - string", () => {
        should(coerceLocalizedText("Hello World")).eql(new LocalizedText({ locale: null, text: "Hello World" }));
    });
    it("#coerceLocalizedText - LocalizedText", () => {
        should(coerceLocalizedText(new LocalizedText({ text: "Hello World" }))).eql(
            new LocalizedText({ locale: null, text: "Hello World" })
        );
    });
    it("#coerceLocalizedText ", () => {
        should(coerceLocalizedText({ text: "Hello World" })).eql(new LocalizedText({ locale: null, text: "Hello World" }));
    });

    it("LocalizedText#shema", () => {
        LocalizedText.schema.name.should.eql("LocalizedText");
    });
    it("LocalizedText#coerce", () => {
        LocalizedText.coerce("A").should.eql(new LocalizedText({ text: "A" }));
    });
    it("LocalizedText#encode/decode", () => {
        const stream = new BinaryStream();
        const localizedText = new LocalizedText("A");
        encodeLocalizedText(localizedText, stream);

        stream.rewind();
        const check = new LocalizedText(null);
        decodeLocalizedText(stream, check);
        check.toString().should.eql("locale=null text=A");
    });
    it("LocalizedText#encode/decode", () => {
        const stream = new BinaryStream();
        const localizedText = new LocalizedText("A");
        encodeLocalizedText(null, stream);

        // form1
        stream.rewind();
        const check1 = decodeLocalizedText(stream);
        check1.toString().should.eql("locale=null text=null");

        // form2
        stream.rewind();
        const check = new LocalizedText(null);
        decodeLocalizedText(stream, check);
        check.toString().should.eql("locale=null text=null");
    });
    it("encode/decode 1", () => {
        const localizedText1 = new LocalizedText("A");
        encode_decode_round_trip_test(localizedText1, (buffer, id) => {
            buffer.length.should.equal(6);
        });
    });
    it("encode/decode 2", () => {
        const localizedText2 = new LocalizedText(null);
        encode_decode_round_trip_test(localizedText2, (buffer, id) => {
            buffer.length.should.equal(1);
        });
    });
    it("encode/decode 3", () => {
        const localizedText3 = new LocalizedText({ locale: "a" });
        localizedText3.toString().should.eql("locale=a text=null");
        encode_decode_round_trip_test(localizedText3, (buffer, id) => {
            buffer.length.should.equal(6);
        });
    });
    it("encode/decode 4", () => {
        const localizedText4 = new LocalizedText({ locale: "a", text: "b" });
        encode_decode_round_trip_test(localizedText4, (buffer, id) => {
            buffer.length.should.equal(11);
        });
    });
});
