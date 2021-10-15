const should = require("should");
const ObjectRegistry = require("..").ObjectRegistry;

describe("testing ObjectRegistry", function () {
    let oldValue = null;

    const registry = new ObjectRegistry();
    before(function () {
        oldValue = ObjectRegistry.doDebug;
        ObjectRegistry.doDebug = true;
    });
    after(function () {
        ObjectRegistry.doDebug = oldValue;
    });

    it("should register and unregister an object", function () {
        const myObj = {
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
