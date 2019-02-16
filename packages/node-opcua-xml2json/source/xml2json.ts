/**
 * @module node-opcua-xml2json
 * node -> see if https://github.com/isaacs/sax-js could be used instead
 */

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires
// tslint:disable:unified-signatures

import * as fs from "fs";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

const LtxParser = require("ltx/lib/parsers/ltx.js");

export type SimpleCallback = (err?: Error) => void;

declare interface LtxParser {
    write(str: string): void;

    end(): void;

    on(eventName: "startElement", eventHandler: (name: string, attrs: XmlAttributes) => void): void;

    on(eventName: "endElement", eventHandler: (name: string) => void): void;

    on(eventName: "text", eventHandler: (name: string) => void): void;

    on(eventName: "close", eventHandler: () => void): void;

}

export interface Parser {
    [key: string]: ReaderState;
}

/**
 * @static
 * @private
 * @method _coerceParser
 * @param parser {map<ReaderState|options>}
 * @return {map}
 */
function _coerceParser(parser: ParserLike): Parser {

    for (const name of Object.keys(parser)) {
        if (parser[name] && !(parser[name] instanceof ReaderState)) {
            // this is to prevent recursion
            const tmp = parser[name];
            delete parser[name];
            parser[name] = new ReaderState(tmp);
        }
    }
    return parser as Parser;
}

export interface XmlAttributes {
    [key: string]: string;
}

export interface ReaderStateParser {
    parser?: ParserLike;
    init?: (this: any, name: string, attrs: XmlAttributes) => void;
    finish?: (this: any) => void;
    startElement?: (this: any, name: string, attrs: XmlAttributes) => void;
    endElement?: (this: any, name: string) => void;
}

export interface ParserLike {
    [key: string]: ReaderStateParserLike;
}
export interface ReaderStateParserLike {
    parser?: ParserLike;
    init?: (this: any, name: string, attrs: XmlAttributes) => void;
    finish?: (this: any) => void;
    startElement?: (this: any, name: string, attrs: XmlAttributes) => void;
    endElement?: (this: any, name: string) => void;
}

/**
 * @class ReaderState
 * @private
 * @param options
 * @param [options.parser=null]  {map<ReaderState|options}}
 * @param [options.init|null]
 * @param [options.finish]
 * @param [options.startElement]
 * @param [options.endElement]
 */
export class ReaderState {

    public _init?: (name: string, attrs: XmlAttributes) => void;
    public _finish?: () => void;
    public _startElement?: (name: string, attrs: XmlAttributes) => void;
    public _endElement?: (name: string) => void;
    public parser: any;
    public attrs?: XmlAttributes;
    public chunks: any[] = [];
    public text: string = "";
    public name?: string = "";
    public engine: any = null;
    public parent?: ReaderState;
    public root?: Xml2Json;

    constructor(options: ReaderStateParser) {

        // ensure options object has only expected properties
        options.parser = options.parser || {};
        const fields = _.keys(options);
        const invalid_fields = _.difference(fields, ["parser", "init", "finish", "startElement", "endElement"]);

        /* istanbul ignore next*/
        if (invalid_fields.length !== 0) {
            // tslint:disable:no-console
            console.log(" Invalid fields detected :", invalid_fields);
            throw new Error("Invalid filed detected in ReaderState Parser !:" + invalid_fields.join(" - "));
        }

        this._init = options.init;
        this._finish = options.finish;
        this._startElement = options.startElement;
        this._endElement = options.endElement;
        this.parser = _coerceParser(options.parser);
    }

    /**
     * @method _on_init
     * @param name  - the name of the element
     * @param attrs
     * @protected
     */
    protected _on_init(name: string, attrs: XmlAttributes) {
        this.attrs = attrs;
        assert(this.attrs);
        if (this._init) {
            this._init(name, attrs);
        }
    }

    /**
     * @method _on_startElement
     * @param name   - the name of the element
     * @param attrs
     * @protected
     */
    protected _on_startElement(name: string, attrs: XmlAttributes) {
        this.chunks = [];
        this.text = "";
        if (this.parser.hasOwnProperty(name)) {
            this.engine._promote(this.parser[name], name, attrs);
        } else if (this._startElement) {
            this._startElement(name, attrs);
        }
    }

    /**
     * @method _on_endElement
     * @param name {String}
     * @protected
     */
    protected _on_endElement(name: string): void {

        assert(this.attrs);

        this.chunks = this.chunks || [];

        if (name === this.name) {
            if (this._finish) {
                this.text = this.chunks.join("");
                this.chunks = [];
                this._finish();
            }
        }

        if (this.parent && this.parent._endElement) {
            this.parent._endElement(name);
        }
        if (name === this.name) {
            // this is the end
            this.engine._demote(this);
        }
    }

    /**
     * @method _on_text
     * @param text {String} the text found inside the element
     * @protected
     */
    protected _on_text(text: string): void {
        this.chunks = this.chunks || [];
        text = text.trim();
        if (text.length === 0) {
            return;
        }
        this.chunks.push(text);
    }

}

const regexp = /(([^:]+):)?(.*)/;

function resolve_namespace(name: string) {
    const m = name.match(regexp);
    if (!m) {
        throw new Error("Invalid match");
    }
    return {
        ns: m[2],
        tag: m[3]
    };
}

/**
 * @class Xml2Json
 * @param options {ReaderState} - the state machine as  a ReaderState node.
 * @param [options.parser=null]  {ReaderState}
 * @param [options.init|null]
 * @param [options.finish]
 * @param [options.startElement]
 * @param [options.endElement]
 * @constructor
 *
 * @example
 *  var parser = new Xml2Json({
 *       parser: {
 *           'person': {
 *               init: function(name,attrs) {
 *                   this.parent.root.obj = {};
 *                   this.obj =  this.parent.root.obj;
 *                   this.obj['name'] = attrs['name'];
 *               },
 *               parser: {
 *                   'address': {
 *                       finish: function(){
 *                           this.parent.obj['address'] = this.text;
 *                       }
 *                   }
 *               }
 *           }
 *       }
 *   });
 *
 * var xml_string =  "<employees>" +
 * "  <person name='John'>" +
 * "     <address>Paris</address>" +
 * "   </person>" +
 * "</employees>";
 *
 * parser.parseString(xml_string, function() {
 *       parser.obj.should.eql({name: 'John',address: 'Paris'});
 *       done();
 *   });
 */
export class Xml2Json {

    private state_stack: any[] = [];
    private current_state: any = null;

    constructor(options: ReaderStateParser) {

        const state = new ReaderState(options);
        state.root = this;

        this.state_stack = [];
        this.current_state = null;
        this._promote(state);
    }

    /**
     * @method parseString
     * @param xml_text the xml string to parse.
     * @param callback
     * @async
     */
    public parseString(xml_text: string, callback: SimpleCallback) {
        const parser = this._prepareParser(callback);
        parser.write(xml_text);
        parser.end();
    }

    /**
     * @method  parse
     * @async
     * @param xmlFile - the name of the xml file to parse.
     * @param callback
     */
    public parse(xmlFile: string, callback: SimpleCallback) {

        const self = this;
        const readWholeFile = true;
        if (readWholeFile) {

            // slightly faster but require more memory ..
            fs.readFile(xmlFile, (err: Error | null, data: Buffer) => {
                if (!err) {
                    if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                        data = data.slice(3);
                    }
                    const dataAsString = data.toString();
                    const parser = self._prepareParser(callback);
                    parser.write(dataAsString);
                    parser.end();
                } else {
                    callback(err);
                }
            });
        } else {
            const Bomstrip = require("bomstrip");
            const parser = self._prepareParser(callback);
            fs.createReadStream(xmlFile, { autoClose: true, encoding: "utf8" })
              .pipe(new Bomstrip())
              .pipe(parser);

        }
    }

    private _promote(new_state: ReaderState, name?: string, attr?: XmlAttributes) {
        attr = attr || {};
        new_state.name = name;
        new_state.parent = this.current_state;
        new_state.engine = this;
        this.state_stack.push(this.current_state);
        this.current_state = new_state;
        this.current_state._on_init(name, attr);
    }

    private _demote(cur_state: ReaderState) {
        assert(this.current_state === cur_state);
        this.current_state = this.state_stack.pop();
    }

    private _prepareParser(callback: (err?: Error) => void): LtxParser {

        const parser = new LtxParser();
        let c = 0;
        parser.on("startElement", (name: string, attrs: XmlAttributes) => {
            const tag_ns = resolve_namespace(name);
            this.current_state._on_startElement(tag_ns.tag, attrs);
            c += 1;
        });
        parser.on("endElement", (name: string) => {
            const tag_ns = resolve_namespace(name);
            this.current_state._on_endElement(tag_ns.tag);
            c -= 1;
            if (c === 0) {
                parser.emit("close");
            }
        });
        parser.on("text", (text: string) => {
            text = text.trim();
            if (text.length === 0) {
                return;
            }
            this.current_state._on_text(text);
        });
        parser.on("close", () => {
            if (callback) {
                callback();
            }
        });
        return parser;
    }
}
