var buffer_ellipsis = require("..").buffer_ellipsis;
var should =require("should");

describe("buffer_ellipsis",function() {


    it("should create a buffer ellipse",function() {
        buffer_ellipsis(new Buffer([0,1,2,3,4])).should.eql("0001020304");
    });

    it("should create a buffer ellipse",function() {
        buffer_ellipsis(new Buffer([
          0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
            21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38]))
        .should.eql("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20212223242526");
    });

    it("should create a buffer ellipse",function() {
        buffer_ellipsis(new Buffer([
            0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
            21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39]))
        .should.eql("00010203040506070809 ... 1e1f2021222324252627");
    });

});