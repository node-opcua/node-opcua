export type TranslationTable = Map<number, number>;

export interface XmlWriter {
    translationTable: TranslationTable;
    priorityTable: number[];
    visitedNode: Set<any>;

    startDocument(options: { encoding: string; version: string }): void;
    startElement(elementName: string): this;

    endElement(): this;

    writeAttribute(attributeName: string, attributeValue: string | number): this;

    writeComment(comment: string): this;

    text(str: string): this;

    endDocument(): void;
}
