var utils = require("..");
var should =require("should");

describe("string_utils",function() {

    describe("capitalizeFirstLetter",function() {
        var capitalizeFirstLetter = utils.capitalizeFirstLetter;

        it("should capitalize a lowercased first letter",function() {
            capitalizeFirstLetter("foo").should.eql("Foo");
        });

        it("should keep a capitalized first letter capitalized",function() {
            capitalizeFirstLetter("Foo").should.eql("Foo");
        })

        it("should handle nulls",function() {
            should.equal(capitalizeFirstLetter(null), null);
        });
    });

    describe("lowerFirstLetter",function() {
        var lowerFirstLetter = utils.lowerFirstLetter;

        it("should lowercase a capitalized first letter",function() {
            lowerFirstLetter("Foo").should.eql("foo");
        });

        it("should keep a lowercased first letter lowercased",function() {
            lowerFirstLetter("foo").should.eql("foo");
        });

        it("should handle nulls",function() {
            should.equal(lowerFirstLetter(null), null);
        });
    });

});
