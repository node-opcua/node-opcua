require("should");
const { ObjectRegistry } = require("..");

describe.skip("testing ObjectRegistry", () => {
    let oldValue = null;

    const registry = new ObjectRegistry();
    before(() => {
        oldValue = ObjectRegistry.doDebug;
        ObjectRegistry.doDebug = true;
    });
    after(() => {
        ObjectRegistry.doDebug = oldValue;
    });

    it("should register and unregister an object", () => {
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
