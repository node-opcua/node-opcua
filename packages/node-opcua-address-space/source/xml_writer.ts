export interface XmlWriter {
    translationTable: any;
    visitedNode: any;

    startDocument(options: { encoding: string; version: string }): void;
    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;

    endDocument(): void;
}
