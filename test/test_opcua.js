var should = require("should");
var util = require("util");
var s  = require("../lib/structures");
var opcua = require("../lib/nodeopcua");

describe("testing OPCUA structures ",function() {

    it("should create a LocalizeText" , function() {

        var ltext = new s.LocalizedText({text: "HelloWorld" , locale: "en-US"});
        ltext.should.have.property("text");
        ltext.should.have.property("locale");
        ltext.text.should.equal("HelloWorld");
        ltext.locale.should.equal("en-US");
    });

    it("should encode and decode a LocalizeText" , function() {

        var ltext = new s.LocalizedText({text: "HelloWorld" , locale: "en-US"});

        var stream = new opcua.BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new s.LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.should.eql(ltext);
        ltext_verif.text.should.equal("HelloWorld");


    });

    it("should create a RequestHeader",function(){


        var requestHeader = new s.RequestHeader();

        requestHeader.should.have.property("authenticationToken");
        requestHeader.should.have.property("timeStamp");
        requestHeader.should.have.property("requestHandle");
        requestHeader.should.have.property("returnDiagnostics");
        requestHeader.should.have.property("auditEntryId");
        requestHeader.should.have.property("timeoutHint");
        requestHeader.should.have.property("additionalHeader");

    });
    it("should create a ResponseHeader", function(){

        var responseHeader = new s.ResponseHeader();

        responseHeader.should.have.property("timeStamp");
        responseHeader.should.have.property("requestHandle");
        responseHeader.should.have.property("serviceResult");
        responseHeader.should.have.property("stringTable");
        responseHeader.should.have.property("additionalHeader");
        responseHeader.stringTable.should.be.instanceOf(Array);

        responseHeader.timeStamp.should.be.lessThan(new Date());
    });


});