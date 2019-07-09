/**
 * @module node-opcua-xml2json
 * node -> see if https://github.com/isaacs/sax-js could be used instead
 */

// tslint:disable:max-classes-per-file
// tslint:disable:no-var-requires
// tslint:disable:unified-signatures

import * as fs from "fs";
import { assert } from "node-opcua-assert";
import { lowerFirstLetter } from "node-opcua-utils";
import * as _ from "underscore";

const LtxParser = require("ltx/lib/parsers/ltx.js");

export type SimpleCallback = (err?: Error) => void;
export type Callback<T> = (err?: Error | null, result?: T) => void;

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
    init?: (
        this: IReaderState,
        name: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        engine: Xml2Json
    ) => void;
    finish?: (this: IReaderState) => void;
    startElement?: (this: IReaderState, name: string, attrs: XmlAttributes) => void;
    endElement?: (this: IReaderState, name: string) => void;
}

export interface ParserLike {
    [key: string]: ReaderStateParserLike;
}

export interface ReaderStateParserLike {
    parser?: ParserLike;
    init?: (
        this: any,
        name: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        engine: Xml2Json
    ) => void;
    finish?: (this: any) => void;
    startElement?: (this: any, name: string, attrs: XmlAttributes) => void;
    endElement?: (this: any, name: string) => void;
}

export interface IReaderState {

    _on_init(
        elementName: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        level: number,
        engine: Xml2Json): void;

    _on_finish(): void;

    _on_startElement(level: number, elementName: string, attrs: XmlAttributes): void;

    _on_endElement(level: number, elementName: string): void;

    _on_endElement2(level: number, elementName: string): void;

    _on_text(text: string): void;
}

type withPojoLambda = (name: string, pojo: any) => void;

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
export class ReaderState implements IReaderState {

    public _init?: (
        name: string, attrs: XmlAttributes,
        parent: IReaderState, engine: Xml2Json
    ) => void;
    public _finish?: () => void;
    public _startElement?: (name: string, attrs: XmlAttributes) => void;
    public _endElement?: (name: string) => void;

    public parser: any;
    public attrs?: XmlAttributes;
    public chunks: any[] = [];
    public text: string = "";
    public name?: string = "";
    public level: number = -1;
    public currentLevel: number = -1;

    public engine?: Xml2Json;

    public parent?: IReaderState;
    public root?: Xml2Json;
    public data?: any;

    constructor(options: ReaderStateParser | ReaderState) {

        // ensure options object has only expected properties
        options.parser = options.parser || {};

        if (!(options instanceof ReaderState)) {

            const fields = _.keys(options);
            const invalid_fields = _.difference(fields, ["parser", "init", "finish", "startElement", "endElement"]);

            /* istanbul ignore next*/
            if (invalid_fields.length !== 0) {
                // tslint:disable:no-console
                throw new Error("Invalid filed detected in ReaderState Parser ! : " +
                    invalid_fields.join(" - ") +
                    " t =" + options.constructor.name);
            }
            this._init = options.init;
            this._finish = options.finish;
            this._startElement = options.startElement;
            this._endElement = options.endElement;
        }

        this.parser = _coerceParser(options.parser);
    }

    /**
     * @method _on_init
     * @param elementName  - the name of the element
     * @param attrs
     * @param parent
     * @param level
     * @param engine
     * @protected
     */
    public _on_init(
        elementName: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        level: number,
        engine: Xml2Json
    ) {

        this.name = elementName;
        this.parent = parent;
        this.engine = engine;
        this.data = {};
        this.level = level;
        this.currentLevel = this.level;
        this.attrs = attrs;
        assert(this.attrs);
        if (this._init) {
            this._init(elementName, attrs, parent, engine);
        }
    }

    public _on_finish() {
        if (this._finish) {
            this._finish();
        }
    }

    /**
     * @param level
     * @param elementName   - the name of the element
     * @param attrs
     * @protected
     */
    public _on_startElement(level: number, elementName: string, attrs: XmlAttributes) {

        this.currentLevel = level;
        // console.log("wxxxx _on_startElement#" + this.name, elementName, this.currentLevel);

        this.chunks = [];
        this.text = "";

        if (this._startElement) {
            this._startElement(elementName, attrs);
        }
        if (this.engine && this.parser.hasOwnProperty(elementName)) {
            // console.log("promoting ", elementName, this.level);
            this.engine._promote(this.parser[elementName], level, elementName, attrs);
        }
    }

    public _on_endElement2(level: number, elementName: string): void {
        if (this._endElement) {
            this._endElement(elementName);
        }
    }

    /**
     * @method _on_endElement
     * @protected
     */
    public _on_endElement(level: number, elementName: string): void {
        // console.log("wxxxx _on_endElement#" + this.name, elementName, level, this.currentLevel);
        assert(this.attrs);
        this.chunks = this.chunks || [];

        if (this.level > level) {
            // we end a child element of this node
            this._on_endElement2(level, elementName);
        } else if (this.level === level) {
            // we received the end event of this node
            // we need to finish
            this.text = this.chunks.join("");
            this.chunks = [];
            // this is the end
            this._on_finish();
            if (this.parent && (this.parent as any).parser && (this.parent as any).parser.hasOwnProperty(elementName)) {
                // console.log("xxx    demoting#" + this.name, elementName, this.level);
                this.engine!._demote(this, level, elementName);
            }
        }
    }

    /**
     * @method _on_text
     * @param text {String} the text found inside the element
     * @protected
     */
    public _on_text(text: string): void {
        this.chunks = this.chunks || [];
        text = text.trim();
        if (text.length === 0) {
            return;
        }
        this.chunks.push(text);
    }

    public startPojo(elementName: string, attrs: XmlAttributes, withPojo: withPojoLambda) {

        this.engine!._promote(json_extractor, this.engine!.currentLevel, elementName, attrs);
        json_extractor._withPojo = (name: string, pojo: any) => {
            withPojo(name, pojo);
            this.engine!._demote(json_extractor, this.engine!.currentLevel, elementName);
        };
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
 * @param options - the state machine as  a ReaderState node.
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

    public currentLevel: number = 0;
    public _pojo = {};

    private state_stack: any[] = [];
    private current_state: IReaderState | null = null;

    constructor(options?: ReaderStateParser) {

        if (!options) {
            this.state_stack = [];
            this.current_state = null;
            this._promote(json_extractor, 0);
            return;
        }
        const state = (options instanceof ReaderState)
            ? options as ReaderState : new ReaderState(options);
        state.root = this;

        this.state_stack = [];
        this.current_state = null;
        this._promote(state, 0);
    }

    /**
     * @method parseString
     * @async
     */
    public parseString(xml_text: string): Promise<any>;
    public parseString(xml_text: string, callback: Callback<any> | SimpleCallback): void;
    public parseString(xml_text: string, callback?: Callback<any> | SimpleCallback): any {
        const parser = this._prepareParser(callback!);
        parser.write(xml_text);
        parser.end();
    }

    /**
     * @method  parse
     * @async
     * @param xmlFile - the name of the xml file to parse.
     */
    public parse(xmlFile: string): Promise<any>;
    public parse(xmlFile: string, callback: Callback<any> | SimpleCallback): void;
    public parse(xmlFile: string, callback?: Callback<any> | SimpleCallback): any {

        if (!callback) {
            throw new Error("internal error");
        }
        const readWholeFile = true;
        if (readWholeFile) {

            // slightly faster but require more memory ..
            fs.readFile(xmlFile, (err: Error | null, data: Buffer) => {
                if (err) {
                    return callback(err);
                }
                if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                    data = data.slice(3);
                }
                const dataAsString = data.toString();
                const parser = this._prepareParser(callback);
                parser.write(dataAsString);
                parser.end();
            });
        } else {

            const Bomstrip = require("bomstrip");

            const parser = this._prepareParser(callback);

            fs.createReadStream(xmlFile, { autoClose: true, encoding: "utf8" })
                .pipe(new Bomstrip())
                .pipe(parser);

        }
    }

    /**
     * @param new_state
     * @param name
     * @param attr
     * @private
     * @internal
     */
    public _promote(new_state: IReaderState, level: number, name?: string, attr?: XmlAttributes) {
        attr = attr || {};
        this.state_stack.push({
            backup: {},
            state: this.current_state
        });

        const parent = this.current_state;
        this.current_state = new_state;
        this.current_state._on_init(name || "???", attr, parent!, level, this);
    }

    /**
     *
     * @private
     * @internal
     */
    public _demote(cur_state: IReaderState, level: number, elementName: string) {
        ///  assert(this.current_state === cur_state);
        const { state, backup } = this.state_stack.pop();
        this.current_state = state;
        if (this.current_state) {
            this.current_state._on_endElement2(level, elementName);
        }
    }

    private _prepareParser(callback: Callback<any> | SimpleCallback): LtxParser {

        const parser = new LtxParser();
        this.currentLevel = 0;
        parser.on("startElement", (name: string, attrs: XmlAttributes) => {
            const tag_ns = resolve_namespace(name);
            this.currentLevel += 1;
            if (this.current_state) {
                this.current_state._on_startElement(this.currentLevel, tag_ns.tag, attrs);
            }
        });
        parser.on("endElement", (name: string) => {
            const tag_ns = resolve_namespace(name);
            if (this.current_state) {
                this.current_state._on_endElement(this.currentLevel, tag_ns.tag);
            }
            this.currentLevel -= 1;
            if (this.currentLevel === 0) {
                parser.emit("close");
            }
        });
        parser.on("text", (text: string) => {
            text = text.trim();
            if (text.length === 0) {
                return;
            }
            if (this.current_state) {
                this.current_state._on_text(text);
            }
        });
        parser.on("close",
            () => {
                if (callback) {
                    (callback as any)(null, this._pojo);
                }
            });
        return parser;
    }
}

class ReaderState2 implements IReaderState {

    public _stack: any;
    public _pojo: any;
    public _element: any;
    public text: string;

    public _withPojo: withPojoLambda;

    private parent?: IReaderState;
    private engine?: Xml2Json;
    private initLevel: number = 0;

    constructor() {
        this._pojo = {};
        this._stack = [];
        this._element = {};
        this.text = "";
        this.parent = undefined;
        this._withPojo = (pojo: any) => { /* empty */
        };
    }

    public _on_init(
        elementName: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        level: number,
        engine: Xml2Json
    ): void {

        this.parent = parent;
        this.engine = engine;
        this.initLevel = level;
        if (this._stack.length === 0) {
            this._pojo = {};
            this._element = this._pojo;
        }
    }

    public _on_finish() {
        /* empy */
    }

    public _on_startElement(level: number, elementName: string, attrs: XmlAttributes): void {

        this._stack.push(this._element);

        if (elementName.match(/^ListOf/)) {
            elementName = elementName.substring(6);
            const elName = lowerFirstLetter(elementName);
            if (this._element instanceof Array) {
                const array: any[] = [];
                this._element.push(array);
                this._element = array;
            } else {
                this._element[elName] = [];
                this._element = this._element[elName];
            }
        } else {
            const elName = lowerFirstLetter(elementName);
            if (this._element instanceof Array) {
                const obj = {};
                this._element.push(obj);
                this._element = obj;
            } else {
                this._element[elName] = {};
                this._element = this._element[elName];
            }
        }

    }

    public _on_endElement2(level: number, elementName: string): void {
        /* empty */
    }

    public _on_endElement(level: number, elementName: string): void {
        this._element = this._stack.pop();
        if (this.text.length > 0 && this._element) {
            const elName = lowerFirstLetter(elementName);
            this._element[elName] = this.text;
            this.engine!._pojo = this._pojo;
        } else {
            const elName = lowerFirstLetter(elementName);
            if (this.initLevel === level) {
                if (this._withPojo) {
                    if (this.text.length) {
                        this._withPojo.call(null, elName, this.text);
                    } else {
                        this._withPojo.call(null, elName, this._pojo);
                    }
                }
            }
        }
        this.text = "";
    }

    public _on_text(text: string): void {
        this.text = text;
    }

}

export const json_extractor: ReaderState2 = new ReaderState2();

export const json_parser: ReaderStateParser = {

    init(
        this: IReaderState,
        elementName: string,
        attrs: XmlAttributes,
        parent: IReaderState,
        engine: Xml2Json
    ) {
        json_extractor._on_init(elementName, attrs, parent, 0, engine);
    },
    finish(this: any) {
        this.parent._pojo = json_extractor._pojo;
    }
};

// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
Xml2Json.prototype.parseString =
    thenify.withCallback(Xml2Json.prototype.parseString, opts);
Xml2Json.prototype.parse =
    thenify.withCallback(Xml2Json.prototype.parse, opts);
