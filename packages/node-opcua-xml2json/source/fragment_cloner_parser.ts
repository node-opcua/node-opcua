import { InternalFragmentClonerReaderState } from "./fragment_cloner";
import { XmlAttributes } from "./xml2json";

export class FragmentClonerParser {
    public value: any;
    private _cloneFragment?: InternalFragmentClonerReaderState;
    constructor() {}

    public startElement(this: any, elementName: string, attrs: XmlAttributes) {
        this._cloneFragment = new InternalFragmentClonerReaderState();
        this.engine!._promote(this._cloneFragment, this.engine!.currentLevel, elementName, attrs);
    }
    public finish() {
        this.value = this._cloneFragment!.value;
        this._cloneFragment!.value = null;
    }
}
