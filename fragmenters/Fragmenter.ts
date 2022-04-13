import { DataFactory, NamedNode, Store } from "n3";
import Node from "../models/node.js";
import Resource from "../models/resource.js";
import { lastPage, updateLastPage } from "../storage/files.js";
import * as RDF from "rdf-js";

const { namedNode, quad, literal } = DataFactory;
export default abstract class Fragmenter {
	folder: string;
	maxResourcesPerPage: number;
	stream: RDF.NamedNode;

	constructor(
		folder: string,
		stream: RDF.NamedNode,
		maxResourcesPerPage: number
	) {
		this.folder = folder;
		this.stream = stream;
		this.maxResourcesPerPage = maxResourcesPerPage;
	}
	constructNewNode(): Node {
		const nodeId = (lastPage("/data" + this.folder) || 0) + 1;
		updateLastPage("/data" + this.folder, nodeId);
		const node = new Node(
			this.generatePageResource(nodeId),
			this.stream,
			namedNode("/pages/1")
		);
		return node;
	}

	fileForNode(nodeId: number): string {
		return `/data${this.folder}/${nodeId}.ttl`;
	}

	getViewFile() {
		return this.fileForNode(1);
	}

	shouldCreateNewPage(node: Node): boolean {
		return node.count() >= this.maxResourcesPerPage;
	}

	generatePageResource(number: number) {
		return namedNode(`${this.folder}/${number}`);
	}

	abstract addResource(resource: Resource): Promise<Node>;
}
