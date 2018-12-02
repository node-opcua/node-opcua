const AddressSpace = require("..").AddressSpace;
const fs = require("fs");
const generate_address_space = require("..").generate_address_space;
const should = require("should");
const mini_nodeset_filename = require("../test_helpers/get_mini_address_space").mini_nodeset_filename;
const LocalizedText = require("node-opcua-data-model").LocalizedText;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing display name in ObjectType and VariableType & Method #469 #466", function () {

    let addressSpace ;
    let namespace;
    before(function(done) {
        addressSpace = new AddressSpace();
        const xml_file = mini_nodeset_filename;
        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {
            namespace = addressSpace.registerNamespace("MyPrivateNamespace");
            namespace.namespaceUri.should.eql("MyPrivateNamespace");
            namespace.index.should.eql(1);
            done(err);
        });
    });

    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });


    it("should be possible to provide a DisplayName when declaring a VariableType - Form 1",function() {

        const variableType = namespace.addVariableType({
            browseName: "MyVariableType1",
            displayName: "Some DisplayName"
        });
        variableType.browseName.toString().should.eql("1:MyVariableType1");
        variableType.displayName.should.be.instanceOf(Array);
        variableType.displayName[0].should.be.instanceOf(LocalizedText);
        variableType.displayName.toString().should.eql("locale=null text=Some DisplayName");

    });
    it("should be possible to provide a DisplayName when declaring a VariableType - Form 2",function() {

        const variableType = namespace.addVariableType({
            browseName: "MyVariableType2",
            displayName: { locale: "de", text: "beliebiger Text" }
        });
        variableType.browseName.toString().should.eql("1:MyVariableType2");
        variableType.displayName.should.be.instanceOf(Array);
        variableType.displayName[0].should.be.instanceOf(LocalizedText);
        variableType.displayName.toString().should.eql("locale=de text=beliebiger Text");

    });
    it("should be possible to provide a DisplayName when declaring a VariableType - Form 3",function() {

        const variableType = namespace.addVariableType({
            browseName: "MyVariableType3",
            displayName: [
                { locale: "de", text: "beliebiger Text" },
                { locale: "ru", text: "любой текст" },
                { locale: "fr", text: "un texte quelconque" }
            ]
        });
        variableType.browseName.toString().should.eql("1:MyVariableType3");
        variableType.displayName.should.be.instanceOf(Array);
        variableType.displayName[0].toString().should.eql("locale=de text=beliebiger Text");
        variableType.displayName[1].toString().should.eql("locale=ru text=любой текст");
        variableType.displayName[2].toString().should.eql("locale=fr text=un texte quelconque");

    });


    it("should be possible to provide a DisplayName when declaring a ObjectType - Form1",function() {
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType1",
            displayName: "Some DisplayName"
        });
        objectType.browseName.toString().should.eql("1:MyObjectType1");
        objectType.displayName.should.be.instanceOf(Array);
        objectType.displayName[0].should.be.instanceOf(LocalizedText);
        objectType.displayName.toString().should.eql("locale=null text=Some DisplayName");

    });
    it("should be possible to provide a DisplayName when declaring a ObjectType - Form2",function() {
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType2",
            displayName: { locale: "de", text: "beliebiger Text" }
        });
        objectType.browseName.toString().should.eql("1:MyObjectType2");
        objectType.displayName.should.be.instanceOf(Array);
        objectType.displayName[0].should.be.instanceOf(LocalizedText);
        objectType.displayName.toString().should.eql("locale=de text=beliebiger Text");

    });
    it("should be possible to provide a DisplayName when declaring a ObjectType - Form3",function() {
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType3",
            displayName: [
                { locale: "de", text: "beliebiger Text" },
                { locale: "ru", text: "любой текст" },
                { locale: "fr", text: "un texte quelconque" }
            ]
        });
        objectType.browseName.toString().should.eql("1:MyObjectType3");
        objectType.displayName.should.be.instanceOf(Array);
        objectType.displayName[0].toString().should.eql("locale=de text=beliebiger Text");
        objectType.displayName[1].toString().should.eql("locale=ru text=любой текст");
        objectType.displayName[2].toString().should.eql("locale=fr text=un texte quelconque");

    });

    it("should be possible to provide a DisplayName when declaring a Method - form 0", function () {

        const obj = namespace.addObject({
            browseName: { name: "BrowseName" }
        });

        const method = namespace.addMethod(obj, {
            browseName: { name: "Bark", namespaceIndex: 1 },
            inputArguments: [],
            outputArguments: []
        });
        method.displayName.should.be.instanceOf(Array);
        method.displayName[0].toString().should.eql("locale=null text=Bark");

    });

    it("should be possible to provide a DisplayName when declaring a Method - form 1", function () {

        const obj = namespace.addObject({
            browseName: "BrowseName"
        });

        const method = namespace.addMethod(obj, {
            browseName: "Bark",
            displayName: { locale: "fr", text: "Aboyer" },
            inputArguments: [],
            outputArguments: []
        });
        method.displayName.should.be.instanceOf(Array);
        method.displayName[0].toString().should.eql("locale=fr text=Aboyer");

    });
});

