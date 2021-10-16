export interface XmlWriter {
    translationTable: any;
    visitedNode: any;

    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;
}
