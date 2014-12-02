
var should = require("should");

var SecurityPolicy = require("../../lib/misc/security_policy").SecurityPolicy;


describe("Security Policy",function(){

    it("should convert a security policy uri to an enum value",function() {

        var enumValue = SecurityPolicy.fromURI("http://opcfoundation.org/UA/SecurityPolicy#None");
        enumValue.should.equal(SecurityPolicy.None);

        enumValue = SecurityPolicy.fromURI("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
        enumValue.should.equal(SecurityPolicy.Basic256Rsa15);
    });

    it("should return SecurityPolicy.Invalid if not supported",function(){

        var enumValue = SecurityPolicy.fromURI("some invalid string");
        enumValue.should.equal(SecurityPolicy.Invalid);

    });
    it("should turn a Security Policy Enum value into an URI",function(){
        var uriValue = SecurityPolicy.toURI(SecurityPolicy.Basic256Rsa15);
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should turn a Security Policy short string to an URI",function(){
        var uriValue = SecurityPolicy.toURI("Basic256Rsa15");
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should thrown an exception when turning an invalid SecurityPolicy into an uri",function(){

       should(function() {
           var uriValue = SecurityPolicy.toURI("<<invalid>>");
           uriValue.should.equal("<invalid>");
       }).throwError();

    });


});