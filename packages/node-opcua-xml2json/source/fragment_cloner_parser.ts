import { InternalFragmentClonerReaderState } from "./fragment_cloner";
import type { XmlAttributes } from "./xml2json";

export class FragmentClonerParser {
    public value: string | null | undefined;
    private _cloneFragment?: InternalFragmentClonerReaderState;
    private engine?: {
        currentLevel: number;
        _promote: (frag: InternalFragmentClonerReaderState, level: number, elementName: string, attrs: XmlAttributes) => void;
    };

    public startElement(elementName: string, attrs: XmlAttributes): void {
        this._cloneFragment = new InternalFragmentClonerReaderState();
        this.engine?._promote(this._cloneFragment, this.engine?.currentLevel, elementName, attrs);
    }
    public finish(): void {
        this.value = this._cloneFragment?.value;
        if (this._cloneFragment) {
            this._cloneFragment.value = null;
        }
    }
}
