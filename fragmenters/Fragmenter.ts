import { DataFactory } from "n3";
import Node from "../models/node";
import Resource from "../models/resource";
import * as RDF from "rdf-js";
import path from "path";
import Cache from "../storage/cache";
const { namedNode } = DataFactory;
export default abstract class Fragmenter {
	folder: string;
	maxResourcesPerPage: number;
	stream: RDF.NamedNode;
	path: RDF.NamedNode;
	cache: Cache;

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
		this.cache = new Cache();
	}
	constructNewNode(): Node {
		const nodeId = (this.cache.getLastPage(this.folder) || 0) + 1;
		console.log(nodeId);
		this.cache.updateLastPage(this.folder, nodeId);
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
