import { NamedNode, Store } from "n3";
import Node from "../models/node.js";
import Resource from "../models/resource.js";

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
		return `/pages${this.folder}/${nodeId}.ttl`;
	}

	getViewFile() {
		return this.fileForNode(1);
	}

	shouldCreateNewPage(node: Node): boolean {
		return node.count() >= this.maxResourcesPerPage;
	}

	abstract addResource(resource: Resource): Promise<Node>;
}
