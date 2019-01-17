import { should } from "should";
import { Xml2Json, XmlAttributes } from "../source/xml2json";
const _should = should;

type ErrorCallback = (err?: Error) => void;

describe("XMLToJSON", () => {

    it("should parse a simple xml data string", (done: ErrorCallback) => {

        let init_called = false;
        let finish_called = false;
        const parser = new Xml2Json({

            parser: {

                person: {

                    init(name: string, attrs: XmlAttributes) {
                        name.should.equal("person");
                        attrs.should.have.property("name");
                        attrs.name.should.equal("John");
                        init_called = true;
                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj.name = attrs.name;
                    },

                    finish() {
                        this.obj.should.eql({ name: "John", address: "Paris" });
                        finish_called = true;
                    },

                    parser: {
                        address: {
                            finish() {
                                this.parent.obj.address = this.text;
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
          "</employees>", () => {

              init_called.should.equal(true);

              finish_called.should.equal(true);

              (parser as any).obj.should.eql({ name: "John", address: "Paris" });
              done();
          });

    });

    it("should parse a UTF8 encoded xml file with a BOM", function(this: any, done: ErrorCallback) {

        const nodesets = require("node-opcua-nodesets");

        // accommodate for slow RPI
        if (process.arch === "arm") {
            this.timeout(40000);
            this.slow(20000);
        }
        const xml_file = nodesets.standard_nodeset_file;
        const parser = new Xml2Json({});
        parser.parse(xml_file, (err?: Error) => {
            done(err);
        });
    });

    it("should parse a escaped string", (done: ErrorCallback) => {

        let displayName: string|null = null;

        const parser = new Xml2Json({

            parser: {
                DisplayName: {
                    finish(this: any) {
                        displayName = this.text;
                    }
                }
            }
        });

        parser.parseString(
          "<object>" +
          "  <DisplayName>&lt;HelloWorld&gt;</DisplayName>" +
          "</object>",  () => {

              displayName!.should.eql("<HelloWorld>");

              done();
          });
    });
});
