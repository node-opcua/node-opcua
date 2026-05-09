import { lowerFirstLetter } from "node-opcua-utils";
import { type IReaderState, ReaderStateBase, type Xml2Json, type XmlAttributes } from "./xml2json";
export type withPojoLambda = (name: string, pojo: unknown) => void;

export class ReaderState2 extends ReaderStateBase {
    public _stack: unknown[];
    public _pojo: unknown;
    
    // biome-ignore lint/suspicious/noExplicitAny: explanation
    public _element: any;
    public text: string;
    public _withPojo: withPojoLambda;


    private initLevel = 0;
    constructor() {
        super();
        this._pojo = {};
        this._stack = [];
        this._element = {};
        this.text = "";
        this._withPojo = (_pojo: unknown) => {
            /* empty */
        };
    }

    public _on_init(_elementName: string, _attrs: XmlAttributes, _parent: IReaderState, level: number, _engine: Xml2Json): void {

        this.initLevel = level;
        if (this._stack.length === 0) {
            this._pojo = {};
            this._element = this._pojo as Record<string, unknown>   ;
        }
    }

    public _on_finish(): void {
        /* empy */
    }

    public _on_startElement(_level: number, elementName: string, _attrs: XmlAttributes): void {
        this._stack.push(this._element);

        if (elementName.match(/^ListOf/)) {
            elementName = elementName.substring(6);
            const elName = lowerFirstLetter(elementName);
            if (Array.isArray(this._element)) {
                const array: unknown[] = [];
                this._element.push(array);
                this._element = array;
            } else {
                this._element[elName] = [];
                this._element = this._element[elName];
            }
        } else {
            const elName = lowerFirstLetter(elementName);
            if (Array.isArray(this._element)) {
                const obj: Record<string, unknown> = {};
                this._element.push(obj);
                this._element = obj;
            } else {
                this._element[elName] = {};
                this._element = this._element[elName];
            }
        }
    }

    public _on_endElement2(_level: number, _elementName: string): void {
        /* empty */
    }

    public _on_endElement(level: number, elementName: string): void {
        this._element = this._stack.pop();
        if (this.text.length > 0 && this._element) {
            const elName = lowerFirstLetter(elementName);
            this._element[elName] = this.text;
            // this.engine!._pojo = this._pojo;
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
