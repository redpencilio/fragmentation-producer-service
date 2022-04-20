import { DataFactory, NamedNode } from "n3";
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
	maxNodeCountPerFolder: number;

	constructor(
		folder: string,
		stream: RDF.NamedNode,
		maxResourcesPerPage: number,
		path: RDF.NamedNode,
		maxNodeCountPerFolder: number
	) {
		this.folder = folder;
		this.stream = stream;
		this.maxResourcesPerPage = maxResourcesPerPage;
		this.path = path;
		this.maxNodeCountPerFolder = maxNodeCountPerFolder;
		this.cache = new Cache();
	}
	constructNewNode(): Node {
		const nodeId = (this.cache.getLastPage(this.folder) || 0) + 1;
		this.cache.updateLastPage(this.folder, nodeId);
		const node = new Node(
			nodeId,
			this.stream,
			this.getRelationReference(nodeId, 1)
		);
		return node;
	}

	fileForNode(nodeId: number): string {
		//Determine in which subfolder nodeId should be located
		let subFolder: string = this.determineSubFolder(nodeId);
		return path.join(this.folder, subFolder, `${nodeId}.ttl`);
	}

	determineSubFolder(nodeId: number): string {
		if (nodeId === 1) {
			return "";
		} else {
			return (
				Math.floor(nodeId / this.maxNodeCountPerFolder) + 1
			).toString();
		}
	}

	getRelationReference(
		sourceNodeId: number,
		targetNodeId: number
	): NamedNode {
		let sourceSubFolder: string = this.determineSubFolder(sourceNodeId);
		let targetSubFolder: string = this.determineSubFolder(targetNodeId);
		if (sourceSubFolder === targetSubFolder) {
			return namedNode(`./${targetNodeId}`);
		} else if (sourceSubFolder === "") {
			return namedNode(
				path.join(".", targetSubFolder, targetNodeId.toString())
			);
		} else {
			return namedNode(
				path.join("..", targetSubFolder, targetNodeId.toString())
			);
		}
	}

	getViewFile() {
		return this.fileForNode(1);
	}

	shouldCreateNewPage(node: Node): boolean {
		return node.count() >= this.maxResourcesPerPage;
	}

	generatePageResource(number: number) {
		return namedNode(`./${number}`);
	}

	abstract addResource(resource: Resource): Promise<Node>;
}
