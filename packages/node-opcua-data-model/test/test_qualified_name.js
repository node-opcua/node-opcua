/*global require,describe,it*/

const should = require("should");

const QualifiedName = require("..").QualifiedName;
const coerceQualifiedName = require("..").coerceQualifyName;

describe("QualifiedName", function () {


    it("should construct a qualified name", function () {
        const qn = new QualifiedName({});
        qn.namespaceIndex.should.eql(0);
        should(qn.name === null).be.equal(true);
    });
    it("testing qualified name toString", function () {
        const qn = new QualifiedName({name: "Hello"});
        qn.toString().should.eql("Hello");
    });
    it("testing qualified name toString", function () {
        const qn = new QualifiedName({namespaceIndex: 2, name: "Hello"});
        qn.toString().should.eql("2:Hello");
    });
    it("should coerce a string into a qualified name ", function () {
        const qn = coerceQualifiedName("Hello");
        qn.toString().should.eql("Hello");
    });
    it("should coerce a qualified name  into a qualified name ", function () {
        const qn = coerceQualifiedName({namespaceIndex: 0, name: "Hello"});
        qn.toString().should.eql("Hello");
    });
    it("should coerce a null object  into a null qualified name ", function () {
        const qn = coerceQualifiedName();
        should(qn).eql(null);
    });
    it("QualifiedName#isEmpty",function() {
        const qn = new QualifiedName({});
        qn.isEmpty().should.eql(true);
    });
});
