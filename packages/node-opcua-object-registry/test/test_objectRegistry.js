

var ObjectRegistry = require("..").ObjectRegistry;
var should = require("should");
require("colors");


describe("testing ObjectRegistry",function() {

    var oldValue = null;

    var registry = new ObjectRegistry();
    before(function() {
        oldValue = ObjectRegistry.doDebug ;
        ObjectRegistry.doDebug = true;
    });
    after(function() {
        ObjectRegistry.doDebug = oldValue;

    });

    it("should register and unregister an object",function(){


        var myObj = {
            name: "HelloWorld"
        };

        registry.register(myObj);

        console.log(registry.toString());

        registry.count().should.eql(1);

        registry.unregister(myObj);
        registry.count().should.eql(0);

        console.log(registry.toString());
    });
});
