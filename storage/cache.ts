import Node from "../models/node";
import {
	readNode,
	readNodeGraphy,
	readNodeStream,
	readTriplesStream,
	writeNode,
} from "./files";
import fs from "fs";
import path from "path";

interface CacheEntry {
	node: Node;
	modified: boolean;
}

function wrapInProxy(cacheEntry: CacheEntry) {
	let nodeChangeHandler = {
		set: function (target, property, value, receiver) {
			target[property] = value;
			cacheEntry.modified = true;
			// you have to return true to accept the changes
			return true;
		},
	};
	return new Proxy(cacheEntry, nodeChangeHandler);
}
export default class Cache {
	nodes: Map<string, CacheEntry> = new Map();

	usageCount: number = 0;

	lruRank: Map<string, number> = new Map();

	lastPages: Map<string, number> = new Map();

	cacheLimit: number = 10000;

	cacheEvictionCount: number = 5000;

	async getNode(path: string) {
		let result: Node;

		if (this.nodes.has(path)) {
			result = this.nodes.get(path)!.node;
		} else {
			try {
				result = await readNodeStream(path);
				let cacheEntry: CacheEntry = { node: result, modified: true };
				this.nodes.set(path, cacheEntry);
			} catch (e) {
				throw e;
			}
		}
		this.updateNodeFrequency(path);
		await this.applyCacheEviction();
		return result;
	}

	updateNodeFrequency(key: string) {
		this.lruRank.set(key, this.usageCount);
		this.usageCount += 1;
	}

	async addNode(path: string, node: Node) {
		this.updateNodeFrequency(path);
		this.nodes.set(path, { node: node, modified: true });
		await this.applyCacheEviction();
	}

	*getFilesRecurs(folder: string) {
		const files = fs.readdirSync(folder, { withFileTypes: true });
		for (const file of files) {
			if (file.isDirectory()) {
				yield* this.getFilesRecurs(path.join(folder, file.name));
			} else {
				yield file.name;
			}
		}
	}

	getLastPage(folder: string): number {
		if (!this.lastPages.has(folder)) {
			if (!fs.existsSync(folder)) {
				return NaN;
			}
			let fileNumbers: number[] = [];
			for (const file of this.getFilesRecurs(folder)) {
				const match = file.match(/\d*/);
				if (match) {
					const parsedNumber = match.length && parseInt(match[0]);
					if (parsedNumber && parsedNumber !== NaN)
						fileNumbers.push(parsedNumber);
				}
			}

			fileNumbers.sort((a, b) => b - a);
			if (fileNumbers.length) {
				this.lastPages.set(folder, fileNumbers[0]);
			} else {
				return NaN; // let's not cache this as it's a starting point
			}
		}

		return this.lastPages.get(folder)!;
	}

	updateLastPage(folder: string, value: number) {
		this.lastPages.set(folder, value);
	}

	async applyCacheEviction() {
		if (this.nodes.size > this.cacheLimit) {
			// Determine least frequently used node
			const lruEntries = Array.from(this.lruRank.entries());
			lruEntries.sort(([k1, v1], [k2, v2]) => v1 - v2);
			const keys = lruEntries
				.map(([k, v]) => k)
				.slice(0, this.cacheEvictionCount);
			if (keys) {
				await this.evictFromCache(keys);
			}
		}
	}

	async evictFromCache(keys: string[]) {
		console.log("Eviction start");
		let listOfPromises: any[] = [];
		for (const key of keys) {
			let node = this.nodes.get(key)?.node;
			if (node) {
				listOfPromises.push(writeNode(node, key));
				this.nodes.delete(key);
				this.lruRank.delete(key);
			}
		}
		await Promise.all(listOfPromises);
		console.log("Eviction end");
	}

	async flush() {
		await this.evictFromCache(Array.from(this.nodes.keys()));
		console.log("Flushed");
	}
}
