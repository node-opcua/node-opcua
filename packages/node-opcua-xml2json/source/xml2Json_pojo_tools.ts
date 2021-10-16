import { lowerFirstLetter } from "node-opcua-utils";
import { IReaderState, ReaderStateBase, Xml2Json, XmlAttributes } from "./xml2json";
export type withPojoLambda = (name: string, pojo: any) => void;

export class ReaderState2 extends ReaderStateBase {
    public _stack: any;
    public _pojo: any;
    public _element: any;
    public text: string;

    public _withPojo: withPojoLambda;

    private parent?: IReaderState;
    private engine?: Xml2Json;
    private initLevel = 0;

    constructor() {
        super();
        this._pojo = {};
        this._stack = [];
        this._element = {};
        this.text = "";
        this.parent = undefined;
        this._withPojo = (pojo: any) => {
            /* empty */
        };
    }

    public _on_init(elementName: string, attrs: XmlAttributes, parent: IReaderState, level: number, engine: Xml2Json): void {
        this.parent = parent;
        this.engine = engine;
        this.initLevel = level;
        if (this._stack.length === 0) {
            this._pojo = {};
            this._element = this._pojo;
        }
    }

    public _on_finish(): void {
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
