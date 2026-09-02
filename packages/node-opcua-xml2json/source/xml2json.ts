/**
 * @module node-opcua-xml2json
 * node -> see if https://github.com/isaacs/sax-js could be used instead
 */

import { assert } from "node-opcua-assert";
import { SaxLtx } from "./thirdparties/parser/lts.js";

export type SimpleCallback = (err?: Error) => void;
export type Callback<T> = (err?: Error | null, result?: T) => void;

export interface Parser {
    [key: string]: ReaderState;
}

/**
 * @static
 * @private

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
    // an element name is looked up in this table for every element of the document; with no
    // prototype behind it the lookup is one hash probe and cannot find an Object member by mistake
    Object.setPrototypeOf(parser, null);
    return parser as Parser;
}

export interface XmlAttributes {
    [key: string]: string;
}

export interface ReaderStateParser {
    parser?: ParserLike;
    init?: (this: IReaderState, name: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) => void;
    finish?: (this: IReaderState) => void;
    startElement?: (this: IReaderState, name: string, attrs: XmlAttributes) => void;
    endElement?: (this: IReaderState, name: string) => void;
}

export interface ParserLike {
    [key: string]: ReaderStateParserLike;
}

export interface ReaderStateParserLike {
    parser?: ParserLike;
    // `this` here is an open extension point — callers across the workspace attach domain-specific
    // shapes (e.g. EUInformationParserLevel2) that only duck-type against ReaderState, so a concrete
    // `this: ReaderState` breaks those call sites structurally.
    // biome-ignore lint/suspicious/noExplicitAny: see comment above
    init?: (this: any, name: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) => void;
    // biome-ignore lint/suspicious/noExplicitAny: see comment above
    finish?: (this: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: see comment above
    startElement?: (this: any, name: string, attrs: XmlAttributes) => void;
    // biome-ignore lint/suspicious/noExplicitAny: see comment above
    endElement?: (this: any, name: string) => void;
}

export interface IReaderState {
    _on_init(elementName: string, attrs: XmlAttributes, parent: IReaderState, level: number, engine: Xml2Json): void;

    _on_finish(): void;

    _on_startElement(level: number, elementName: string, attrs: XmlAttributes): void;

    _on_endElement(level: number, elementName: string): void;

    _on_endElement2(level: number, elementName: string): void;

    _on_text(text: string): void;
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: interface adds typed members/overloads for this class
export class ReaderStateBase {}
export interface ReaderStateBase extends IReaderState {}
/**
 * @private
 */
export class ReaderState extends ReaderStateBase {
    public _init?: (name: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) => void;
    public _finish?: () => void;
    public _startElement?: (name: string, attrs: XmlAttributes) => void;
    public _endElement?: (name: string) => void;

    public parser: Parser;
    public attrs?: XmlAttributes;
    public chunks: string[] = [];
    public text = "";
    public name? = "";
    public level = -1;
    public currentLevel = -1;

    public engine?: Xml2Json;

    public parent?: IReaderState;
    public root?: Xml2Json;
    private _data?: Record<string, unknown>;

    /** scratch space for the reader, fresh for every element it reads, allocated on first use */
    public get data(): Record<string, unknown> {
        if (!this._data) {
            this._data = {};
        }
        return this._data;
    }
    public set data(value: Record<string, unknown> | undefined) {
        this._data = value;
    }

    constructor(options: ReaderStateParser | ReaderState) {
        super();
        // ensure options object has only expected properties
        options.parser = options.parser || {};

        if (!(options instanceof ReaderStateBase)) {
            this._init = options.init;
            this._finish = options.finish;
            this._startElement = options.startElement;
            this._endElement = options.endElement;
        }

        this.parser = _coerceParser(options.parser);
    }

    /**
     * @protected
     */
    public _on_init(elementName: string, attrs: XmlAttributes, parent: IReaderState, level: number, engine: Xml2Json): void {
        this.name = elementName;
        this.parent = parent;
        this.engine = engine;
        this._data = undefined;
        this.level = level;
        this.currentLevel = this.level;
        this.attrs = attrs;
        assert(this.attrs);
        if (this._init) {
            this._init(elementName, attrs, parent, engine);
        }
    }
    /**
     * @protected
     */
    public _on_finish(): void {
        if (this._finish) {
            this._finish();
        }
    }

    /**
     * @protected
     */
    public _on_startElement(level: number, elementName: string, attrs: XmlAttributes): void {
        this.currentLevel = level;

        this.chunks = [];
        this.text = "";

        if (this._startElement) {
            this._startElement(elementName, attrs);
        }
        const child = this.parser[elementName];
        if (this.engine && child) {
            this.engine._promote(child, level, elementName, attrs);
        }
    }

    /**
     * @protected
     */
    public _on_endElement2(_level: number, elementName: string): void {
        if (this._endElement) {
            this._endElement(elementName);
        }
    }

    /**

     * @protected
     */
    public _on_endElement(level: number, elementName: string): void {
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
            if (this.parent instanceof ReaderState && this.parent.parser[elementName]) {
                this.engine?._demote(this, level, elementName);
            }
        }
    }

    /**
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
}

const regexp = /(([^:]+):)?(.*)/;

interface ResolvedName {
    ns: string | undefined;
    tag: string;
}

// a document uses a few dozen distinct element names, each of them thousands of times
const resolvedNames = new Map<string, ResolvedName>();

function resolve_namespace(name: string): ResolvedName {
    const known = resolvedNames.get(name);
    if (known) {
        return known;
    }
    const m = name.match(regexp);
    if (!m) {
        throw new Error("Invalid match");
    }
    const resolved: ResolvedName = { ns: m[2], tag: m[3] };
    resolvedNames.set(name, resolved);
    return resolved;
}

/**
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
/** how many times a reader state is active at once, kept on the state itself */
const activations = Symbol("activations");
interface ActivationCounted {
    [activations]?: number;
}

export class Xml2Json {
    public currentLevel = 0;
    // two parallel stacks rather than one record per element: an element is pushed and popped
    // for each of the hundreds of thousands a nodeset carries
    private state_stack: Array<IReaderState | null> = [];
    private backup_stack: Array<Record<string, unknown> | null> = [];
    private current_state: IReaderState | null = null;
    private sax: SaxLtx | null = null;
    private decoder: TextDecoder | null = null;
    private atStart = false;

    constructor(options: ReaderStateParser) {
        const state = options instanceof ReaderStateBase ? (options as ReaderState) : new ReaderState(options);
        state.root = this;

        this.state_stack = [];
        this.backup_stack = [];
        this.current_state = null;
        this._promote(state, 0);
    }

    public parseString(xml_text: string): Record<string, unknown> {
        return this.__parseInternal(xml_text);
    }

    /**
     * parse a document that arrives in pieces: text, or UTF-8 bytes decoded as they come (a
     * multi-byte character or the byte-order mark may straddle two chunks)
     */
    public async parseStream(
        chunks: AsyncIterable<string | Uint8Array> | Iterable<string | Uint8Array>
    ): Promise<Record<string, unknown>> {
        this.begin();
        for await (const chunk of chunks) {
            this.write(chunk);
        }
        return this.end();
    }

    /** start a document that {@link write} will feed and {@link end} will finish */
    public begin(): void {
        this.currentLevel = 0;
        this.atStart = true;
        this.decoder = null;
        // direct handlers rather than events, and the blank runs between tags dropped by the
        // parser before they are unescaped: see SaxLtxHandlers
        const sax = new SaxLtx({
            skipBlankText: true,
            onStartElement: (name: string, attrs: XmlAttributes) => {
                const tag_ns = resolve_namespace(name);
                this.currentLevel += 1;
                if (this.current_state) {
                    this.current_state._on_startElement(this.currentLevel, tag_ns.tag, attrs);
                }
            },
            onEndElement: (name: string) => {
                const tag_ns = resolve_namespace(name);
                if (this.current_state) {
                    this.current_state._on_endElement(this.currentLevel, tag_ns.tag);
                }
                this.currentLevel -= 1;
                if (this.currentLevel === 0) {
                    sax.emit("close");
                }
            },
            onText: (text: string) => {
                // the reader state trims what it receives; nothing blank reaches this point
                if (this.current_state) {
                    this.current_state._on_text(text);
                }
            }
        });
        this.sax = sax;
    }

    /** feed the next piece of the document started by {@link begin} */
    public write(chunk: string | Uint8Array): void {
        const sax = this.sax;
        if (!sax) {
            throw new Error("Xml2Json#write: begin() must be called first");
        }
        let text: string;
        if (typeof chunk === "string") {
            text = chunk;
        } else {
            this.decoder = this.decoder || new TextDecoder("utf-8");
            text = this.decoder.decode(chunk, { stream: true });
        }
        if (text.length === 0) {
            return;
        }
        if (this.atStart) {
            this.atStart = false;
            if (text.charCodeAt(0) === 0xfeff) {
                text = text.slice(1);
            }
        }
        sax.write(text);
    }

    /** finish the document started by {@link begin} and return what the reader states built */
    public end(): Record<string, unknown> {
        const sax = this.sax;
        if (!sax) {
            throw new Error("Xml2Json#end: begin() must be called first");
        }
        if (this.decoder) {
            const tail = this.decoder.decode();
            this.decoder = null;
            if (tail.length > 0) {
                sax.write(tail);
            }
        }
        sax.end("");
        this.sax = null;
        if (!this.current_state) {
            return {};
        }
        return (this.current_state as unknown as { _pojo: Record<string, unknown> })._pojo;
    }
    /**
     * @private
     * @internal
     */
    public _promote(new_state: IReaderState, level: number, name?: string, attr?: XmlAttributes): void {
        attr = attr || {};

        // a reader state carries the state of the element being read, so the same instance cannot be
        // active at two levels at once. This happens when a data type refers to itself, directly or
        // indirectly: the reader of the nested element is then the very same object as the outer one.
        // In that case only, take a copy of the outer activation and restore it in _demote.
        const counted = new_state as ActivationCounted;
        const active = counted[activations] || 0;
        counted[activations] = active + 1;

        this.state_stack.push(this.current_state);
        this.backup_stack.push(active > 0 ? { ...(new_state as unknown as Record<string, unknown>) } : null);

        const parent = this.current_state;
        this.current_state = new_state;
        // parent is null only for the root element; every _on_init implementation in this codebase
        // names the parameter `_parent` (unused), so widening the public IReaderState signature to
        // accept null would ripple into every consumer package that already treats it as non-null.
        // biome-ignore lint/style/noNonNullAssertion: see comment above
        this.current_state._on_init(name || "???", attr, parent!, level, this);
    }

    /**
     * @private
     * @internal
     */
    public _demote(cur_state: IReaderState, level: number, elementName: string): void {
        ///  assert(this.current_state === cur_state);
        if (this.state_stack.length === 0) {
            throw new Error("_demote called without a matching _promote");
        }
        const state = this.state_stack.pop() as IReaderState | null;
        const backup = this.backup_stack.pop() as Record<string, unknown> | null;
        this.current_state = state;
        if (this.current_state) {
            this.current_state._on_endElement2(level, elementName);
        }

        const counted = cur_state as ActivationCounted;
        counted[activations] = (counted[activations] || 1) - 1;
        if (backup) {
            // cur_state was a nested activation of a state that is still active at an outer level:
            // put the outer element back the way it was. The parent has already consumed the nested
            // value in _on_endElement2 above, so nothing is lost here.
            const state_as_object = cur_state as unknown as Record<string, unknown>;
            for (const key of Object.keys(state_as_object)) {
                delete state_as_object[key];
            }
            Object.assign(state_as_object, backup);
        }
    }

    /**
     * @private
     * @internal
     */
    protected __parseInternal(data: string): Record<string, unknown> {
        this.begin();
        this.write(data);
        return this.end();
    }
}
