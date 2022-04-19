import Node from "../models/node";
import { readNode, writeNode } from "./files";
import fs from "fs";
export default class Cache {
	nodes: Map<String, Node> = new Map();

	lastPages: Map<String, number> = new Map();

	async getNode(path: string) {
		if (this.nodes.has(path)) {
			return this.nodes.get(path)!;
		}
		try {
			const node = await readNode(path);
			this.nodes.set(path, node);
			return node;
		} catch (e) {
			throw e;
		}
	}

	async setNode(path: string, node: Node) {
		this.nodes.set(path, node);
		await writeNode(node, path);
	}

	getLastPage(folder: string): number {
		if (!fs.existsSync(folder)) {
			return NaN;
		}
		if (!this.lastPages.has(folder)) {
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
}
