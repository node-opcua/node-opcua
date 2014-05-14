var should = require("should");
var util = require("util");
var s  = require("../lib/datamodel/structures");
var opcua = require("../lib/nodeopcua");
var BinaryStream = require("../lib/misc/binaryStream").BinaryStream;
var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;

describe("testing OPCUA structures ",function() {

    it("should create a LocalizeText" , function() {

        var ltext = new s.LocalizedText({text: "HelloWorld" , locale: "en-US"});
        ltext.should.have.property("text");
        ltext.should.have.property("locale");
        ltext.text.should.equal("HelloWorld");
        ltext.locale.should.equal("en-US");

    });



    it("should encode and decode a LocalizeText that have both text and locale" , function() {

        var ltext = new s.LocalizedText({text: "HelloWorld" , locale: "en-US"});

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new s.LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.should.eql(ltext);
        ltext_verif.text.should.equal("HelloWorld");
        ltext_verif.locale.should.equal("en-US");


    });

    it("should encode and decode a LocalizeText that have text but no locale" , function() {

        var ltext = new s.LocalizedText({text: "HelloWorld" , locale: null });

        ltext.should.have.property("locale");
        should(ltext.locale).equal(null);

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new s.LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.text.should.equal("HelloWorld");
        should(ltext_verif.locale).equal(null);

    });

    it("should encode and decode a LocalizeText that have no text but a locale" , function() {

        var ltext = new s.LocalizedText({text: null , locale: "en-US" });

        ltext.should.have.property("text");
        should(ltext.text).equal(null);

        var stream = new BinaryStream();
        stream.length.should.equal(0);

        ltext.encode(stream);

        stream.length.should.be.greaterThan(0);

        var ltext_verif = new s.LocalizedText();

        stream.rewind();
        ltext_verif.decode(stream);

        ltext_verif.should.eql(ltext);
        ltext_verif.locale.should.equal("en-US");
        ltext_verif.should.have.property("text");
        should(ltext_verif.text).equal(null);

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

describe("Testing ChannelSecurityToken", function(){

    it("should exposed a expired property", function(){

        var channelSecurityToken = new  s.ChannelSecurityToken({});

        channelSecurityToken.revisedLifeTime.should.equal(30000);
        channelSecurityToken.createdAt.getTime().should.be.lessThan((new Date().getTime() +1));
        (channelSecurityToken.expired).should.equal(false);

    });
    it("a ChannelSecurityToken should expired after the revisedLifeTime", function(done){
        var channelSecurityToken = new  s.ChannelSecurityToken({
            revisedLifeTime: 3
        });
        (channelSecurityToken.expired).should.equal(false);
        setTimeout(function(){
            (channelSecurityToken.expired).should.equal(true);
            done();
        },10);
    });


});

