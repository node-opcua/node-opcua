require("requirish")._(module);

var should = require("should");

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;


describe("Security Policy",function(){

    it("should convert a security policy uri to an enum value",function() {

        var enumValue = securityPolicy_m.fromURI("http://opcfoundation.org/UA/SecurityPolicy#None");
        enumValue.should.equal(SecurityPolicy.None);

        enumValue = securityPolicy_m.fromURI("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
        enumValue.should.equal(SecurityPolicy.Basic256Rsa15);
    });

    it("should return SecurityPolicy.Invalid if not supported",function(){

        var enumValue = securityPolicy_m.fromURI("some invalid string");
        enumValue.should.equal(SecurityPolicy.Invalid);

    });
    it("should turn a Security Policy Enum value into an URI",function(){
        var uriValue = securityPolicy_m.toURI(SecurityPolicy.Basic256Rsa15);
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should turn a Security Policy short string to an URI",function(){
        var uriValue = securityPolicy_m.toURI("Basic256Rsa15");
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should thrown an exception when turning an invalid SecurityPolicy into an uri",function(){

       should(function() {
           var uriValue = securityPolicy_m.toURI("<<invalid>>");
           uriValue.should.equal("<invalid>");
       }).throwError();

    });


});