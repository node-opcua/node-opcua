export interface ITranslationTable {
    [key: number]: number;
}
export interface XmlWriter {
    translationTable: ITranslationTable;
    priorityTable: number[];
    visitedNode: any;

    startDocument(options: { encoding: string; version: string }): void;
    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;

    endDocument(): void;
}
