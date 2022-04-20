import Node from "../models/node";
import { readNode, writeNode } from "./files";
import fs from "fs";
import onChange from "on-change";

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
			this.nodes.set(path, { node, modified: false });
			onChange(node, () => {
				console.log("change");
				this.nodes.set(path, { node, modified: true });
			});
			return node;
		} catch (e) {
			throw e;
		}
	}

	addNode(path: string, node: Node) {
		this.nodes.set(path, { node, modified: true });
		onChange(node, () => {
			console.log("change");
			this.nodes.set(path, { node, modified: true });
		});
	}

	async setNode(path: string, node: Node) {
		this.nodes.set(path, { node, modified: true });
		await writeNode(node, path);
	}

	getLastPage(folder: string): number {
		if (!this.lastPages.has(folder)) {
			if (!fs.existsSync(folder)) {
				return NaN;
			}
			const files = fs.readdirSync(folder);
			const fileNumbers = files
				.map((path) => {
					const match = path.match(/\d*/);
					if (match) {
						const parsedNumber = match.length && parseInt(match[0]);
						if (parsedNumber && parsedNumber !== NaN)
							return parsedNumber;
						else return NaN;
					} else {
						return NaN;
					}
				})
				.filter((x) => x !== NaN);

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
			if (cacheEntry.modified) {
				await writeNode(cacheEntry.node, path);
				cacheEntry.modified = false;
			}
		}
		console.log("Flushed");
	}
}
