import { IReaderState, ReaderState, ReaderStateParser, Xml2Json, XmlAttributes } from "./xml2json";
import { ReaderState2, withPojoLambda } from "./xml2Json_pojo_tools";

const json_extractor: ReaderState2 = new ReaderState2();
export const json_parser: ReaderStateParser = {
    init(this: IReaderState, elementName: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) {
        json_extractor._on_init(elementName, attrs, parent, 0, engine);
    },
    finish(this: any) {
        this.parent._pojo = json_extractor._pojo;
    }
};

export function startPojo(pThis: ReaderState, elementName: string, attrs: XmlAttributes, withPojo: withPojoLambda): void {
    pThis.engine!._promote(json_extractor, pThis.engine!.currentLevel, elementName, attrs);
    json_extractor._withPojo = (name: string, pojo: any) => {
        withPojo(name, pojo);
        pThis.engine!._demote(json_extractor, pThis.engine!.currentLevel, elementName);
    };
}

export class Xml2JsonPojo extends Xml2Json {
    constructor() {
        super(json_extractor as ReaderStateParser);
    }
}
