import Dequeue from "dequeue";
export class Queue {
    _d = new Dequeue();
    size;
    constructor() {
        this.size = 0;
    }
    clear() {
        this.size = 0;
    }
    first() {
        if (this.size === 0) {
            return undefined;
        }
        return this._d.first();
    }
    shift() {
        if (this.size === 0) {
            return undefined;
        }
        this.size -= 1;
        return this._d.shift();
    }
    push(value) {
        this.size += 1;
        this._d.push(value);
    }
    filterOut(predicate) {
        let counter = 0;
        let p = this._d.head.next;
        while (p !== this._d.head) {
            const shouldRemove = predicate(p.data);
            const pPrev = p;
            p = p.next;
            if (shouldRemove) {
                this.size -= 1;
                counter += 1;
                pPrev.remove();
            }
        }
        return counter;
    }
    values() {
        const self = this;
        const iteratable = {
            [Symbol.iterator]() {
                let cursor = self._d.head;
                const iterator = {
                    next() {
                        cursor = cursor.next;
                        if (cursor === self._d.head) {
                            return { done: true, value: null };
                        }
                        const ret = {
                            done: false,
                            value: cursor.data
                        };
                        return ret;
                    }
                };
                return iterator;
            }
        };
        return iteratable;
    }
}
//# sourceMappingURL=queue.js.map