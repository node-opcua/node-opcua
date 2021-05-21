// tslint:disable:no-console
import * as mocha from "mocha";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import * as should  from "should";
import { ParserLike, ReaderStateParserLike, Xml2Json, XmlAttributes } from "..";
import { Xml2JsonFs } from "../source/nodejs/xml2json_fs";
import { nodesets } from "node-opcua-nodesets";

const doDebug = checkDebugFlag("TEST");
const debugLog = make_debugLog("TEST");

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
                        debugLog("person:init name = ", name);
                        name.should.equal("person");
                        attrs.should.have.property("name");
                        attrs.name.should.equal("John");
                        init_called = true;
                        this.parent.root.obj = {};
                        this.obj = this.parent.root.obj;
                        this.obj.name = attrs.name;
                    },

                    finish() {
                        debugLog("person:finish name = ");
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
            "<employees>" + "   <person name='John'>" + "     <address>Paris</address>" + "   </person>" + "</employees>",
            () => {
                init_called.should.equal(true);

                finish_called.should.equal(true);

                (parser as any).obj.should.eql({ name: "John", address: "Paris" });
                done();
            }
        );
    });

    it("should parse a UTF8 encoded xml file with a BOM", function (this: any, done: ErrorCallback) {
        // accommodate for slow RPI
        if (process.arch === "arm") {
            this.timeout(40000);
            this.slow(20000);
        }
        const xml_file = nodesets.standard;
        const parser = new Xml2JsonFs({});
        parser.parse(xml_file, (err?: Error) => {
            done(err);
        });
    });

    it("should parse a escaped string", (done: ErrorCallback) => {
        let displayName: string | null = null;

        const parser = new Xml2Json({
            parser: {
                DisplayName: {
                    finish(this: any) {
                        displayName = this.text;
                    }
                }
            }
        });

        parser.parseString("<object>" + "  <DisplayName>&lt;HelloWorld&gt;</DisplayName>" + "</object>", () => {
            displayName!.should.eql("<HelloWorld>");

            done();
        });
    });

    it("should parse a array", (done: ErrorCallback) => {
        function BasicType_parser1(dataType: string, parseFunc: (this: any, text: string) => any): ParserLike {
            const _parser: ParserLike = {};

            const r: ReaderStateParserLike = {
                init(this: any, name: string, attrs: XmlAttributes) {
                    this.value = 0;
                },

                finish(this: any) {
                    this.value = parseFunc.call(this, this.text);
                    // xx console.log("xxx.... parser, ", this.value);
                }
            };
            _parser[dataType] = r;
            return _parser;
        }

        function ListOf1(dataType: string, parseFunc: any) {
            return {
                init(this: any) {
                    this.listData = [];
                },

                parser: BasicType_parser1(dataType, parseFunc),

                finish(this: any) {
                    this.parent.array = {
                        value: this.listData
                    };
                    // xx console.log("xxx.... finish, ", this.parent.parent);
                },
                endElement(this: any, element: string) {
                    this.listData.push(this.parser[dataType].value);
                    // xx console.log("xxx.... endElement, ", this.listData);
                }
            };
        }

        const state_Variant = {
            parser: {
                ListOfFloat: ListOf1("Float", parseFloat)
            }
        };

        const parser = new Xml2Json(state_Variant);

        parser.parseString(
            `<Value>
            <uax:ListOfFloat>
                <uax:Float>11</uax:Float>
                <uax:Float>12</uax:Float>
                <uax:Float>13</uax:Float>
                <uax:Float>21</uax:Float>
                <uax:Float>22</uax:Float>
                <uax:Float>23</uax:Float>
                <uax:Float>31</uax:Float>
                <uax:Float>32</uax:Float>
                <uax:Float>33</uax:Float>
            </uax:ListOfFloat>
        </Value>`,
            () => {
                done();
            }
        );
    });
    it("should parse a array 2", (done: ErrorCallback) => {
        done();
    });
});
