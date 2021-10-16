import { Xml2Json, XmlAttributes, IReaderState } from "./xml2json";

interface XmlWriter {
    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;
}
const XMLWriter = require("xml-writer");

export class InternalFragmentClonerReaderState implements IReaderState {
    private _xw: XmlWriter = new XMLWriter(true);
    public value: any;
    public initLevel = 0;
    public engine?: Xml2Json;

    public _on_startElement(level: number, elementName: string, attrs: XmlAttributes): void {
        this._xw.startElement(elementName);
        for (const [attName, attValue] of Object.entries(attrs)) {
            this._xw.writeAttribute(attName, attValue);
        }
    }
    public _on_endElement(level: number, elementName: string): void {
        this._xw.endElement();
        if (this.initLevel === level) {
            this.value = this._xw.toString();
            this.engine!._demote(this, this.engine!.currentLevel, elementName);
            this.engine = undefined;
            this._on_finish();
        }
    }
    public _on_init(elementName: string, attrs: XmlAttributes, parent: IReaderState, level: number, engine: Xml2Json): void {
        this.engine = engine;
        this.initLevel = level;
        this._xw = new XMLWriter(true);
        this._xw.startElement(elementName);
        for (const [attName, attValue] of Object.entries(attrs)) {
            this._xw.writeAttribute(attName, attValue);
        }
    }

    public _on_finish(): void {
        /** */
    }

    public _on_endElement2(level: number, elementName: string): void {
        /** */
    }

    public _on_text(text: string): void {
        this._xw.text(text);
    }
}
