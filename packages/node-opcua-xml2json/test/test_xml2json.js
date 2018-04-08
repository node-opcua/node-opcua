const Xml2Json = require("..").Xml2Json;
const should = require("should");

describe("XMLToJSON", function () {

    it("should parse a simple xml data string", function (done) {

        let init_called = false;
        let finish_called = false;
        const parser = new Xml2Json({

            parser: {
                'person': {
                    init: function (name, attrs) {
                        name.should.equal("person");
                        attrs.should.have.property("name");
                        attrs['name'].should.equal("John");
                        init_called = true;

                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj['name'] = attrs['name'];
                    },
                    finish: function (name) {

                        this.obj.should.eql({name: 'John', address: 'Paris'});
                        finish_called = true;
                    },
                    parser: {
                        'address': {
                            finish: function () {
                                this.parent.obj['address'] = this.text;
                            }
                        }
                    }
                }
            }
        });

        parser.parseString(
            "<employees>" +
            "   <person name='John'>" +
            "     <address>Paris</address>" +
            "   </person>" +
            "</employees>", function () {

                init_called.should.equal(true);

                finish_called.should.equal(true);

                parser.obj.should.eql({name: 'John', address: 'Paris'});
                done();
            });

    });
    xit("should parse a UTF8 encoded xml file with a BOM", function (done) {

        const nodesets = require("node-opcua-nodesets");

        // accommodate for slow RPI
        if (process.arch === "arm") {
            this.timeout(40000);
            this.slow(20000);
        }
        const xml_file = nodesets.standard_nodeset_file;
        const parser = new Xml2Json({});
        parser.parse(xml_file, function (err) {
            done(err);
        });
    });

    it("should parse a escaped string",function (done) {

        let displayName = null;
        const parser = new Xml2Json({
            parser: {
                'DisplayName': {
                    finish: function () {
                        displayName = this.text;
                    }
                }
            }
        });

        parser.parseString(
            "<object>" +
            "  <DisplayName>&lt;HelloWorld&gt;</DisplayName>" +
            "</object>", function () {
                displayName.should.eql("<HelloWorld>");
                done();
            });


    });

});
