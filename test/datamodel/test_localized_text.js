"use strict";
require("requirish")._(module);
var should = require("should");
var util = require("util");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

describe("LocalizedText", function () {

    it("should create a LocalizeText", function () {

        var ltext = new LocalizedText({text: "HelloWorld", locale: "en-US"});
        ltext.should.have.property("text");
        ltext.should.have.property("locale");
        ltext.text.should.equal("HelloWorld");
        ltext.locale.should.equal("en-US");

    });

    it("should encode and decode a LocalizeText that have both text and locale", function () {

        var ltext = new LocalizedText({text: "HelloWorld", locale: "en-US"});

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.should.eql(ltext);
        ltext_verif.text.should.equal("HelloWorld");
        ltext_verif.locale.should.equal("en-US");


    });

    it("should encode and decode a LocalizeText that have text but no locale", function () {

        var ltext = new LocalizedText({text: "HelloWorld", locale: null});

        ltext.should.have.property("locale");
        should(ltext.locale).equal(null);

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.text.should.equal("HelloWorld");
        should(ltext_verif.locale).equal(null);

    });

    it("should encode and decode a LocalizeText that have no text but a locale", function () {

        var ltext = new LocalizedText({text: null, locale: "en-US"});

        ltext.should.have.property("text");
        should(ltext.text).equal(null);

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.should.eql(ltext);
        ltext_verif.locale.should.equal("en-US");
        ltext_verif.should.have.property("text");
        should(ltext_verif.text).equal(null);

    });

    var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
    it("#coerceLocalizedText - null", function () {

        should(coerceLocalizedText(null)).eql(null);
    });
    it("#coerceLocalizedText - string", function () {

        should(coerceLocalizedText("Hello World")).eql(new LocalizedText({locale: null, text: "Hello World"}));
    });
    it("#coerceLocalizedText - LocalizedText", function () {

        should(coerceLocalizedText(new LocalizedText({text: "Hello World"}))).eql(new LocalizedText({locale: null, text: "Hello World"}));
    });

});
