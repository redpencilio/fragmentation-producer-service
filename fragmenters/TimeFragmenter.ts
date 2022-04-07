import { Store, Quad, NamedNode, DataFactory } from "n3";
import {
	generatePageResource,
	generateTreeRelation,
	generateVersion,
	nowLiteral,
} from "../utils/utils";
import Fragmenter from "./Fragmenter";
const { namedNode, quad, literal } = DataFactory;

import * as RDF from "rdf-js";
import { ldes, prov, purl, rdf, tree } from "../utils/namespaces";
import {
	clearLastPageCache,
	createStore,
	getNode,
	lastPage,
	readTriplesStream,
	writeTriplesStream,
} from "../storage/files";
import Resource from "../models/resource";
import Node from "../models/node";

export default class TimeFragmenter extends Fragmenter {
	constructNewNode(): Node {
		const store = new Store();
		const subject = this.stream;
		store.addQuad(subject, rdf("type"), ldes("EventStream"));
		store.addQuad(subject, rdf("type"), tree("Collection"));
		store.addQuad(subject, ldes("timeStampPath"), prov("generatedAtTime"));
		store.addQuad(subject, tree("view"), namedNode("/pages?page=1"));
		return new Node(store);
	}
	constructVersionedResource(resource: Resource): Resource {
		const versionedResourceId = generateVersion(resource.id);
		const versionedStore = new Store();
		resource.data.forEach(
			(quadObj) => {
				versionedStore.add(
					quad(
						quadObj.subject.equals(resource.id)
							? versionedResourceId
							: quadObj.subject,
						quadObj.predicate.equals(resource.id)
							? versionedResourceId
							: quadObj.predicate,
						quadObj.object.equals(resource.id)
							? versionedResourceId
							: quadObj.object
					)
				);
			},
			null,
			null,
			null,
			null
		);

		const dateLiteral = nowLiteral();

		// add resources about this version
		versionedStore.add(
			quad(versionedResourceId, purl("isVersionOf"), resource.id)
		);

		versionedStore.add(
			quad(versionedResourceId, prov("generatedAtTime"), dateLiteral)
		);

		versionedStore.add(
			quad(this.stream, tree("member"), versionedResourceId)
		);

		return new Resource(versionedResourceId, versionedStore);
	}

	async closeDataset(node: Node, pageNr: number): Promise<Node> {
		try {
			const relationResource = generateTreeRelation();
			const currentPageResource = generatePageResource(pageNr);
			const nextPageResource = generatePageResource(pageNr + 1);
			node.data.add(
				quad(currentPageResource, tree("relation"), relationResource)
			);
			node.data.add(
				quad(
					relationResource,
					rdf("type"),
					tree("GreaterThanOrEqualRelation")
				)
			);
			node.data.add(
				quad(relationResource, tree("node"), nextPageResource)
			);
			node.data.add(
				quad(relationResource, tree("path"), prov("generatedAtTime"))
			);
			const dateLiteral = nowLiteral();
			node.data.add(quad(relationResource, tree("value"), dateLiteral));

			// create a store with the new graph for the new file
			const currentNode = this.constructNewNode();

			currentNode.data.add(
				quad(nextPageResource, rdf("type"), tree("Node"))
			);
			return currentNode;
		} catch (e) {
			throw e;
		}
	}

	async writeVersionedResource(versionedResource: Resource): Promise<Node> {
		try {
			const lastPageNr = lastPage(this.folder);
			let pageFile = this.fileForNode(lastPageNr);

			let currentNode = await getNode(readTriplesStream(pageFile));

			// let currentDataset = await createStore(readTriplesStream(pageFile));

			if (this.shouldCreateNewPage(currentNode)) {
				const closingNode = currentNode;

				// link the current dataset to the new dataset but don't save yet
				const closingPageFile = pageFile;
				const nextPageFile = this.fileForNode(lastPageNr + 1);

				// create a store with the new graph for the new file
				currentNode = await this.closeDataset(closingNode, lastPageNr);

				currentNode.data.addQuads(
					versionedResource.data.getQuads(null, null, null, null)
				);

				// // Write out new dataset to nextPageFile
				await writeTriplesStream(currentNode.data, nextPageFile);
				// // Write out closing dataset to closingPageFile
				await writeTriplesStream(closingNode.data, closingPageFile);
				// Clear the last page cache
				clearLastPageCache(this.folder);
			} else {
				currentNode.data.addQuads(
					versionedResource.data.getQuads(null, null, null, null)
				);
				await writeTriplesStream(currentNode.data, pageFile);
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
