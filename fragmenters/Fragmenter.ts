import { NamedNode, Store } from "n3";
import Node from "../models/node.js";
import Resource from "../models/resource.js";

import {
	clearLastPageCache,
	createStore,
	lastPage,
	readTriplesStream,
	writeTriplesStream,
} from "../storage/files.js";
import { countVersionedItems } from "../utils/utils";

export default abstract class Fragmenter {
	folder: string;
	maxResourcesPerPage: number;
	stream: NamedNode;

	constructor(
		folder: string,
		stream: NamedNode,
		maxResourcesPerPage: number
	) {
		this.folder = folder;
		this.stream = stream;
		this.maxResourcesPerPage = maxResourcesPerPage;
	}
	abstract constructNewNode(): Node;

	fileForNode(nodeId: number): string {
		return `${this.folder}/${nodeId}.ttl`;
	}

	shouldCreateNewPage(node: Node): boolean {
		return node.count() >= this.maxResourcesPerPage;
	}

	abstract addResource(resource: Resource): Promise<Node>;
}
