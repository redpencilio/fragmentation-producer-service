import Node from "../models/node";
import { readNode, writeNode } from "./files";
import fs from "fs";
import onChange from "on-change";
import path from "path";

interface CacheEntry {
	node: Node;
	modified: boolean;
}
export default class Cache {
	nodes: Map<string, CacheEntry> = new Map();

	lastPages: Map<string, number> = new Map();

	async getNode(path: string) {
		if (this.nodes.has(path)) {
			return this.nodes.get(path)!.node;
		}
		try {
			const node = await readNode(path);
			let cacheEntry: CacheEntry = { node, modified: true };

			var nodeChangeHandler = {
				set: function (target, property, value, receiver) {
					console.log("MODIFIED");
					target[property] = value;
					cacheEntry.modified = true;
					// you have to return true to accept the changes
					return true;
				},
			};
			let cacheEntryProxy = new Proxy(cacheEntry, nodeChangeHandler);
			this.nodes.set(path, cacheEntryProxy);
			// this.nodes.set(path, { node, modified: false });
			// onChange(node, () => {
			// 	console.log("MODIFICATION");
			// 	this.nodes.set(path, { node, modified: true });
			// });
			return node;
		} catch (e) {
			throw e;
		}
	}

	addNode(path: string, node: Node) {
		let cacheEntry: CacheEntry = { node, modified: true };

		var nodeChangeHandler = {
			set: function (target, property, value, receiver) {
				target[property] = value;
				cacheEntry.modified = true;
				// you have to return true to accept the changes
				return true;
			},
		};
		let cacheEntryProxy = new Proxy(node, nodeChangeHandler);
		this.nodes.set(path, cacheEntryProxy);
	}

	async setNode(path: string, node: Node) {
		this.nodes.set(path, { node, modified: true });
		await writeNode(node, path);
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

	async flush() {
		console.log("Start flush");
		for (const [path, cacheEntry] of this.nodes) {
			// if (cacheEntry.modified) {
			await writeNode(cacheEntry.node, path);
			cacheEntry.modified = false;
			// }
		}
		console.log("Flushed");
	}
}
