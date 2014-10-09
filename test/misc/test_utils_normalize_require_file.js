

var should = require("should");
var normalize_require_file = require("../../lib/misc/utils").normalize_require_file;

describe("normalize_require_file",function(){

    it("should normalize_require_file",function(){
        normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").
            should.eql("./folder2/toto");
    });

});