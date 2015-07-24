"use strict";
require("requirish")._(module);
var should = require("should");
var assert = require("assert");
var path = require("path");

var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

var NodeId = require("lib/datamodel/nodeid").NodeId;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;

describe("testing address space namespace", function () {

    it("#getNamespaceUri : should have namespace 0", function () {

        var address_space = new AddressSpace();
        address_space.getNamespaceUri(0).should.eql("http://opcfoundation.org/UA/");

    });
    it("#registerNamespace should register new namespace", function () {
        var address_space = new AddressSpace();
        var namespaceUri = "http://MyNEWNameSpace";
        address_space.getNamespaceIndex(namespaceUri).should.eql(-1);
        var index = address_space.registerNamespace(namespaceUri);
        address_space.getNamespaceIndex(namespaceUri).should.eql(index);
    });

});

var fs = require("fs");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

describe("testing  address space namespace loading", function () {

    before(function (done) {

        done();
    });
    it("should process namespaces and translate namespace index when loading node set xml files", function (done) {

        var address_space = new AddressSpace();
        var xml_files = [
            path.join(__dirname, "../../lib/server/mini.Node.Set2.xml"),
            path.join(__dirname, "../fixtures/fixture_custom_nodeset.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        address_space.registerNamespace("ServerNamespaceURI");
        address_space.getNamespaceArray().length.should.eql(2);

        generate_address_space(address_space, xml_files, function (err) {

            address_space.getNamespaceArray().length.should.eql(4);
            address_space.getNamespaceArray()[2].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
            address_space.getNamespaceArray()[3].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");

            address_space.findObject("ns=2;i=1").browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
            address_space.findObject("ns=3;i=1").browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

            address_space.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/"
            ]);
            done(err);
        });
    });

    it("should process multiple xml files that reference each other", function (done) {
        var address_space = new AddressSpace();
        var xml_files = [
            path.join(__dirname, "../../lib/server/mini.Node.Set2.xml"),
            path.join(__dirname, "../fixtures/fixture_custom_nodeset.xml"),
            path.join(__dirname, "../fixtures/fixture_custom_nodeset_extension.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        address_space.registerNamespace("ServerNamespaceURI");
        address_space.getNamespaceArray().length.should.eql(2);

        generate_address_space(address_space, xml_files, function (err) {

            address_space.getNamespaceArray().length.should.eql(5);
            address_space.getNamespaceArray()[2].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
            address_space.getNamespaceArray()[3].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");
            address_space.getNamespaceArray()[4].should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/");

            address_space.findObject("ns=2;i=1").browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
            address_space.findObject("ns=3;i=1").browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

            address_space.findObject("ns=2;i=1000").browseName.toString().should.eql("2:AnOtherObjectInCUSTOM_NAMESPACE1");
            address_space.findObject("ns=3;i=1000").browseName.toString().should.eql("3:AnOtherObjectInCUSTOM_NAMESPACE2");

            address_space.findObject("ns=4;i=1").browseName.toString().should.eql("4:ObjectInCUSTOM_NAMESPACE3");

            address_space.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/"
            ]);
            done(err);
        });
    });


    it("should process namespaces with DI", function (done) {

        var address_space = new AddressSpace();
        var xml_files = [
            path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml"),
            path.join(__dirname, "../../nodesets/Opc.Ua.Di.NodeSet2.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        address_space.registerNamespace("ServerNamespaceURI");
        address_space.getNamespaceArray().length.should.eql(2);

        generate_address_space(address_space, xml_files, function (err) {

            should(err).eql(null);
            address_space.getNamespaceArray().length.should.eql(3);
            address_space.getNamespaceArray()[2].should.eql("http://opcfoundation.org/UA/DI/");

            address_space.getNamespaceArray().should.eql([
                "http://opcfoundation.org/UA/",   // 0
                "ServerNamespaceURI",             // 1
                "http://opcfoundation.org/UA/DI/",// 2
            ]);
            done();
        });
    });
});
