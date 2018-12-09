import * as _ from "underscore";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";

export interface IWatchdogData2 {
    key: number;
    subscriber: ISubscriber;
    timeout: number;
    last_seen: number;
    visitCount: number;
}
export interface ISubscriber {
    _watchDog?: WatchDog;
    _watchDogData: IWatchdogData2;
    watchdogReset: () => void;
    keepAlive?: () => void;
    onClientSeen?: (t: Date) => void;
}

function has_expired(watchDogData: IWatchdogData2, currentTime: number) {
    const elapsed_time = currentTime - watchDogData.last_seen;
    return elapsed_time > watchDogData.timeout;
}

function keepAliveFunc(this: ISubscriber) {
    const self: ISubscriber = this as ISubscriber;
    assert(self._watchDog instanceof WatchDog);
    assert(_.isNumber(self._watchDogData.key));
    self._watchDogData.last_seen = Date.now();
    if (self.onClientSeen) {
        self.onClientSeen(new Date(self._watchDogData.last_seen));
    }
}

export class WatchDog extends EventEmitter {
    private readonly _watchdogDataMap: { [id: number]: IWatchdogData2 };
    private _counter: number;
    private _current_time: number;
    private _timer: NodeJS.Timer | null;
    private readonly _visit_subscriber_b: (...args: any[]) => void;

    constructor() {
        super();

        this._watchdogDataMap = {};
        this._counter = 0;
        this._current_time = Date.now();
        this._visit_subscriber_b = this._visit_subscriber.bind(this);
        this._timer = null; // as NodeJS.Timer;
    }

    private _visit_subscriber() {
        const self = this;

        self._current_time = Date.now();

        const expired_subscribers = _.filter(self._watchdogDataMap, function(watchDogData: IWatchdogData2) {
            watchDogData.visitCount += 1;
            return has_expired(watchDogData, self._current_time);
        });

        //xx console.log("_visit_subscriber", _.map(expired_subscribers, _.property("key")));
        if (expired_subscribers.length) {
            self.emit("timeout", expired_subscribers);
        }
        expired_subscribers.forEach((watchDogData: IWatchdogData2) => {
            self.removeSubscriber(watchDogData.subscriber);
            watchDogData.subscriber.watchdogReset();
        });
        //xx self._current_time = Date.now();
    }

    /**
     * add a subscriber to the WatchDog.
     * @method addSubscriber
     *
     * add a subscriber to the WatchDog.
     *
     * This method modifies the subscriber be adding a
     * new method to it called 'keepAlive'
     * The subscriber must also provide a "watchdogReset". watchdogReset will be called
     * if the subscriber failed to call keepAlive withing the timeout period.
     * @param subscriber
     * @param timeout
     * @return {number}
     */
    addSubscriber(subscriber: ISubscriber, timeout: number) {
        const self = this;
        self._current_time = Date.now();
        timeout = timeout || 1000;
        assert(_.isNumber(timeout), " invalid timeout ");
        assert(_.isFunction(subscriber.watchdogReset), " the subscriber must provide a watchdogReset method ");
        assert(!_.isFunction(subscriber.keepAlive));

        self._counter += 1;
        const key = self._counter;

        subscriber._watchDog = self;
        subscriber._watchDogData = {
            key: key,
            subscriber: subscriber,
            timeout: timeout,
            last_seen: self._current_time,
            visitCount: 0
        } as IWatchdogData2;

        self._watchdogDataMap[key] = subscriber._watchDogData;

        if (subscriber.onClientSeen) {
            subscriber.onClientSeen(new Date(subscriber._watchDogData.last_seen));
        }
        subscriber.keepAlive = keepAliveFunc.bind(subscriber);

        // start timer when the first subscriber comes in
        if (self.subscriberCount === 1) {
            assert(self._timer === null);
            this._start_timer();
        }

        return key;
    }

    removeSubscriber(subscriber: ISubscriber) {
        if (!subscriber._watchDog) {
            return; // already removed !!!
        }
        assert(subscriber._watchDog instanceof WatchDog);
        assert(_.isNumber(subscriber._watchDogData.key));
        assert(_.isFunction(subscriber.keepAlive));
        assert(this._watchdogDataMap.hasOwnProperty(subscriber._watchDogData.key));

        delete this._watchdogDataMap[subscriber._watchDogData.key];
        delete subscriber._watchDog;
        delete subscriber._watchDogData;
        delete subscriber.keepAlive;

        // delete timer when the last subscriber comes out
        //xx console.log("xxxx WatchDog.prototype.removeSubscriber ",this.subscriberCount );
        if (this.subscriberCount === 0) {
            this._stop_timer();
        }
    }

    shutdown(): void {
        assert(
            this._timer === null && Object.keys(this._watchdogDataMap).length === 0,
            " leaking subscriber in watchdog"
        );
    }
    /**
     * returns the number of subscribers using the WatchDog object.
     * @property subscriberCount
     * @type {number}
     */
    get subscriberCount(): number {
        return Object.keys(this._watchdogDataMap).length;
    }

    private _start_timer(): void {
        assert(this._timer === null, " setInterval already called ?");
        this._timer = setInterval(this._visit_subscriber_b, 1000) as NodeJS.Timer;
    }
    private _stop_timer(): void {
        assert(this._timer !== null, "_stop_timer already called ?");
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}
