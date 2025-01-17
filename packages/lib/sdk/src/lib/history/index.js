import { detailedDiff } from 'deep-object-diff';

/** @typedef {import("./types.js").Diff} Diff */

/**
 * @template {Object} [T=any]
 */
export class History {
	/** @type {Diff[]} */
	#history = [];
	get generations() {
		return [...this.#history];
	}
	constructor() {}

	/** @type {T | {}} */
	#prev = {};
	/**
	 * @param {T} value
	 */
	push(value) {
		const organize = (o) => {
			let tmp = Object.entries(o);
			tmp = tmp.sort((a, b) => a[0].localeCompare(b[0]));
			tmp = Object.fromEntries(tmp);
			return JSON.parse(JSON.stringify(tmp));
		};

		const pre = organize(this.#prev);
		const post = organize(value);
		const diff = detailedDiff(pre, post);
		this.#history.push({
			...diff,
			before: pre,
			after: post,
			asof: new Date()
		});
		this.#prev = post;
		this.publish();
	}

	////////////////////////////////////
	/// < Implement Store Contract > ///
	////////////////////////////////////
	/** @type {Set<(v: Diff[]) => void>} */
	#subscribers = new Set();

	/**
	 * @param {(v: Diff[]) => void} fn
	 * @returns {() => void} Unsubscribe function
	 */
	subscribe = (fn) => {
		this.#subscribers.add(fn);
		fn(this.generations);
		return () => this.#subscribers.delete(fn);
	};

	#publishIdx = 0;
	/**
	 * @protected
	 */
	publish = () => {
		if (this.#publishIdx++ > 100000) throw new Error('History published too many times.');
		this.#subscribers.forEach((fn) => fn(this.generations));
	};
	//////////////////////////////////////
	/// </ Implement Store Contract /> ///
	//////////////////////////////////////
}
