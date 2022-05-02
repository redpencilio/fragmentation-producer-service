import { Store, Quad, NamedNode, DataFactory } from "n3";
import {
	generateTreeRelation,
	generateVersion,
	nowLiteral,
} from "../utils/utils";
import Fragmenter from "./Fragmenter";

const { quad } = DataFactory;

import { ldes, prov, purl, rdf, tree } from "../utils/namespaces";
import Resource from "../models/resource";
import Node from "../models/node";
import Relation from "../models/relation";

export default class TimeFragmenter extends Fragmenter {
	constructVersionedResource(resource: Resource): Resource {
		const versionedResourceId = generateVersion(resource.id);
		const versionedResource = new Resource(versionedResourceId);

		versionedResource.dataMap = new Map(resource.dataMap);

		const dateLiteral = nowLiteral();

		// add resources about this version
		versionedResource.addProperty(purl("isVersionOf").value, resource.id);

		versionedResource.addProperty(
			prov("generatedAtTime").value,
			dateLiteral
		);

		return versionedResource;
	}

	async closeDataset(node: Node, pageNr: number): Promise<Node> {
		try {
			// create a store with the new graph for the new file
			const currentNode = this.constructNewNode();
			const time = nowLiteral();
			node.add_relation(
				time.value,
				new Relation(
					generateTreeRelation(),
					tree("GreaterThanOrEqualRelation"),
					time,
					this.getRelationReference(node.id, currentNode.id),
					currentNode.id,
					prov("generatedAtTime")
				)
			);
			this.cache.addNode(this.fileForNode(currentNode.id), currentNode);
			return currentNode;
		} catch (e) {
			throw e;
		}
	}

	async writeVersionedResource(versionedResource: Resource): Promise<Node> {
		try {
			const lastPageNr = this.cache.getLastPage(this.folder);
			let currentNode: Node;
			let pageFile;
			if (lastPageNr) {
				pageFile = this.fileForNode(lastPageNr);
				currentNode = await this.cache.getNode(pageFile);
			} else {
				console.log("No viewnode");
				currentNode = this.constructNewNode();
				pageFile = this.fileForNode(currentNode.id);
				this.cache.addNode(pageFile, currentNode);
			}

			// let currentDataset = await createStore(readTriplesStream(pageFile));

			if (this.shouldCreateNewPage(currentNode)) {
				const closingNode = currentNode;

				// create a store with the new graph for the new file
				currentNode = await this.closeDataset(closingNode, lastPageNr);

				currentNode.add_member(versionedResource);

				// Clear the last page cache
			} else {
				currentNode.add_member(versionedResource);
			}
			return currentNode;
		} catch (e) {
			throw e;
		}
	}

	async addResource(resource: Resource): Promise<Node> {
		const versionedResource: Resource =
			await this.constructVersionedResource(resource);
		const lastDataset = await this.writeVersionedResource(
			versionedResource
		);
		return lastDataset;
	}
}
