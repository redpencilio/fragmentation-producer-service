import { Store, Quad, NamedNode, DataFactory } from "n3";
import {
	generateTreeRelation,
	generateVersion,
	nowLiteral,
} from "../utils/utils";
import Fragmenter from "./Fragmenter";
import * as RDF from "rdf-js";

const { quad } = DataFactory;

import { ldes, prov, purl, rdf, tree } from "../utils/namespaces";
import {
	clearLastPageCache,
	readNode,
	lastPage,
	writeNode,
} from "../storage/files";
import Resource from "../models/resource";
import Node from "../models/node";
import Relation from "../models/relation";

export default class TimeFragmenter extends Fragmenter {
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
			const nextPageResource = this.generatePageResource(pageNr + 1);
			const dateLiteral = nowLiteral();

			node.add_relation(
				new Relation(
					relationResource,
					tree("GreaterThanOrEqualRelation"),
					dateLiteral,
					nextPageResource,
					prov("generatedAtTime")
				)
			);

			// create a store with the new graph for the new file
			const currentNode = this.constructNewNode();
			clearLastPageCache(this.folder);
			return currentNode;
		} catch (e) {
			throw e;
		}
	}

	async writeVersionedResource(versionedResource: Resource): Promise<Node> {
		try {
			const lastPageNr = lastPage(this.folder);
			console.log(lastPageNr);
			let pageFile = this.fileForNode(lastPageNr.toString());

			let currentNode = await readNode(pageFile);

			// let currentDataset = await createStore(readTriplesStream(pageFile));

			if (this.shouldCreateNewPage(currentNode)) {
				const closingNode = currentNode;

				// link the current dataset to the new dataset but don't save yet
				const closingPageFile = pageFile;
				const nextPageFile = this.fileForNode(
					(lastPageNr + 1).toString()
				);

				// create a store with the new graph for the new file
				currentNode = await this.closeDataset(closingNode, lastPageNr);

				currentNode.add_member(versionedResource);

				await writeNode(currentNode, nextPageFile);
				await writeNode(closingNode, closingPageFile);
				// Clear the last page cache
				clearLastPageCache(this.folder);
			} else {
				currentNode.add_member(versionedResource);

				await writeNode(currentNode, pageFile);
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
