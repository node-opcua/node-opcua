"use strict";

var should = require("should");
var path = require("path");
var AddressSpace = require("..").AddressSpace;
var getFixture = require("node-opcua-test-fixtures").getFixture;
var nodesets = require("node-opcua-nodesets");
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space namespace", function () {

    it("#getNamespaceUri : should have namespace 0", function () {

        var addressSpace = new AddressSpace();

        addressSpace.getNamespaceUri(0).should.eql("http://opcfoundation.org/UA/");

        addressSpace.dispose();
    });
    it("#registerNamespace should register new namespace", function () {

        var addressSpace = new AddressSpace();

        var namespaceUri = "http://MyNEWNameSpace";
        addressSpace.getNamespaceIndex(namespaceUri).should.eql(-1);
        var index = addressSpace.registerNamespace(namespaceUri);
        addressSpace.getNamespaceIndex(namespaceUri).should.eql(index);

        addressSpace.dispose();

    });

});

var fs = require("fs");
var generate_address_space = require("..").generate_address_space;

describe("testing  address space namespace loading", function () {

    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {

        var addressSpace = new AddressSpace();
        var xml_files = [
            path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml"),
            getFixture("fixture_custom_nodeset.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        generate_address_space(addressSpace, xml_files, function (err) {

            addressSpace.getNamespaceArray().length.should.eql(4);
            addressSpace.getNamespaceArray()[2].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
            addressSpace.getNamespaceArray()[3].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");

            addressSpace.findNode("ns=2;i=1").browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
            addressSpace.findNode("ns=3;i=1").browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

            addressSpace.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/"
            ]);

            addressSpace.dispose();
            done(err);
        });
    });

    it("should process multiple xml files that reference each other", function (done) {
        var addressSpace = new AddressSpace();
        var xml_files = [
            path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml"),
            getFixture("fixture_custom_nodeset.xml"),
            getFixture("fixture_custom_nodeset_extension.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        generate_address_space(addressSpace, xml_files, function (err) {

            addressSpace.getNamespaceArray().length.should.eql(5);
            addressSpace.getNamespaceArray()[2].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
            addressSpace.getNamespaceArray()[3].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");
            addressSpace.getNamespaceArray()[4].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/");

            addressSpace.findNode("ns=2;i=1").browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
            addressSpace.findNode("ns=3;i=1").browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

            addressSpace.findNode("ns=2;i=1000").browseName.toString().should.eql("2:AnOtherObjectInCUSTOM_NAMESPACE1");
            addressSpace.findNode("ns=3;i=1000").browseName.toString().should.eql("3:AnOtherObjectInCUSTOM_NAMESPACE2");

            addressSpace.findNode("ns=4;i=1").browseName.toString().should.eql("4:ObjectInCUSTOM_NAMESPACE3");

            addressSpace.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/"
            ]);
            addressSpace.dispose();
            done(err);
        });
    });

    // increase test timeout as test may take time on slow arm computers
    this.timeout(Math.max(100000,this._timeout));

    it("should process namespaces with DI", function (done) {

        var addressSpace = new AddressSpace();
        var xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        generate_address_space(addressSpace, xml_files, function (err) {

            should(err).eql(null);
            addressSpace.getNamespaceArray().length.should.eql(3);
            addressSpace.getNamespaceArray()[2].should.eql("http://opcfoundation.org/UA/DI/");

            addressSpace.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",   // 0
                "ServerNamespaceURI",             // 1
                "http://opcfoundation.org/UA/DI/",// 2
            ]);

            var di_ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
            di_ns.should.eql(2);

            // now try to retrieve some VariableType from DI namespace
            var UIElementType = addressSpace.findVariableType("UIElementType",di_ns);
            UIElementType.browseName.toString().should.eql("2:UIElementType");
            should(addressSpace.findVariableType("UIElementType")).eql(undefined,"namespace is not provided");
            should(addressSpace.findVariableType("2:UIElementType")).eql(UIElementType);


            // now extract some ObjectType From DI namespace
            var TransferServicesType = addressSpace.findObjectType("TransferServicesType",di_ns);
            TransferServicesType.browseName.toString().should.eql("2:TransferServicesType");
            should(addressSpace.findObjectType("TransferServicesType")).eql(undefined,"namespace is not provided");
            should(addressSpace.findObjectType("2:TransferServicesType")).eql(TransferServicesType);

            // now extract some ReferenceType
            var ConnectsToRefType = addressSpace.findReferenceType("ConnectsTo",di_ns);
            ConnectsToRefType.browseName.toString().should.eql("2:ConnectsTo");
            should(addressSpace.findReferenceType("ConnectsTo")).eql(undefined,"namespace is not provided");
            should(addressSpace.findReferenceType("2:ConnectsTo")).eql(ConnectsToRefType);

            // now extract some DataType
            var ParameterResultDataType = addressSpace.findDataType("ParameterResultDataType",di_ns);
            ParameterResultDataType.browseName.toString().should.eql("2:ParameterResultDataType");
            should(addressSpace.findDataType("ParameterResultDataType")).eql(undefined,"namespace is not provided");
            should(addressSpace.findDataType("2:ParameterResultDataType")).eql(ParameterResultDataType);

            addressSpace.dispose();

            done();
        });
    });
});
