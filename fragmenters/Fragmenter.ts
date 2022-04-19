import { DataFactory } from "n3";
import Node from "../models/node";
import Resource from "../models/resource";
import { lastPage, updateLastPage } from "../storage/files";
import * as RDF from "rdf-js";
import path from "path";
const { namedNode } = DataFactory;
export default abstract class Fragmenter {
	folder: string;
	maxResourcesPerPage: number;
	stream: RDF.NamedNode;
	path: RDF.NamedNode;

	constructor(
		folder: string,
		stream: RDF.NamedNode,
		maxResourcesPerPage: number,
		path: RDF.NamedNode
	) {
		this.folder = folder;
		this.stream = stream;
		this.maxResourcesPerPage = maxResourcesPerPage;
		this.path = path;
	}
	constructNewNode(): Node {
		const nodeId = (lastPage(this.folder) || 0) + 1;
		updateLastPage(this.folder, nodeId);
		const node = new Node(
			this.generatePageResource(nodeId),
			this.stream,
			this.generatePageResource(1)
		);
		return node;
	}

	fileForNode(nodeId: string): string {
		return path.join(this.folder, `${nodeId}.ttl`);
	}

	getViewFile() {
		return this.fileForNode("1");
	}

	shouldCreateNewPage(node: Node): boolean {
		return node.count() >= this.maxResourcesPerPage;
	}

	generatePageResource(number: number) {
		return namedNode(`./${number}`);
	}

	abstract addResource(resource: Resource): Promise<Node>;
}
