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
	lastPage,
	readTriplesStream,
	writeTriplesStream,
} from "../storage/files";

export default class TimeFragmenter extends Fragmenter {
	constructPageTemplate(): Store {
		const store = new Store();
		const subject = this.stream;
		store.addQuad(subject, rdf("type"), ldes("EventStream"));
		store.addQuad(subject, rdf("type"), tree("Collection"));
		store.addQuad(subject, ldes("timeStampPath"), prov("generatedAtTime"));
		store.addQuad(subject, tree("view"), namedNode("/pages?page=1"));
		return store;
	}
	constructVersionedStore(store: Store, resource: NamedNode<string>): Store {
		const versionedResource = generateVersion(resource);
		const versionedStore = new Store();
		store.forEach(
			(quadObj) => {
				versionedStore.add(
					quad(
						quadObj.subject.equals(resource)
							? versionedResource
							: quadObj.subject,
						quadObj.predicate.equals(resource)
							? versionedResource
							: quadObj.predicate,
						quadObj.object.equals(resource)
							? versionedResource
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
			quad(versionedResource, purl("isVersionOf"), resource)
		);

		versionedStore.add(
			quad(versionedResource, prov("generatedAtTime"), dateLiteral)
		);

		versionedStore.add(
			quad(this.stream, tree("member"), versionedResource)
		);

		return versionedStore;
	}

	async closeDataset(store: Store, pageNr: number): Promise<Store> {
		try {
			const relationResource = generateTreeRelation();
			const currentPageResource = generatePageResource(pageNr);
			const nextPageResource = generatePageResource(pageNr + 1);
			store.add(
				quad(currentPageResource, tree("relation"), relationResource)
			);
			store.add(
				quad(
					relationResource,
					rdf("type"),
					tree("GreaterThanOrEqualRelation")
				)
			);
			store.add(quad(relationResource, tree("node"), nextPageResource));
			store.add(
				quad(relationResource, tree("path"), prov("generatedAtTime"))
			);
			const dateLiteral = nowLiteral();
			store.add(quad(relationResource, tree("value"), dateLiteral));

			// create a store with the new graph for the new file
			const currentDataset = this.constructPageTemplate();

			currentDataset.add(
				quad(nextPageResource, rdf("type"), tree("Node"))
			);
			return currentDataset;
		} catch (e) {
			throw e;
		}
	}

	async writeVersionedResource(versionedStore: Store): Promise<Store> {
		try {
			const lastPageNr = lastPage(this.folder);
			let pageFile = this.fileForNode(lastPageNr);

			let currentDataset = await createStore(readTriplesStream(pageFile));

			if (this.shouldCreateNewPage(currentDataset)) {
				const closingDataset = currentDataset;

				// link the current dataset to the new dataset but don't save yet
				const closingPageFile = pageFile;
				const nextPageFile = this.fileForNode(lastPageNr + 1);

				// create a store with the new graph for the new file
				currentDataset = await this.closeDataset(
					closingDataset,
					lastPageNr
				);

				currentDataset.addQuads(
					versionedStore.getQuads(null, null, null, null)
				);

				// // Write out new dataset to nextPageFile
				await writeTriplesStream(currentDataset, nextPageFile);
				// // Write out closing dataset to closingPageFile
				await writeTriplesStream(closingDataset, closingPageFile);
				// Clear the last page cache
				clearLastPageCache(this.folder);
			} else {
				currentDataset.addQuads(
					versionedStore.getQuads(null, null, null, null)
				);
				await writeTriplesStream(currentDataset, pageFile);
			}
			return currentDataset;
		} catch (e) {
			throw e;
		}
	}

	async addResource(
		resource_id: NamedNode,
		resource_data: Store
	): Promise<Store> {
		const versionedStore: Store = await this.constructVersionedStore(
			resource_data,
			resource_id
		);
		const lastDataset = await this.writeVersionedResource(versionedStore);
		return lastDataset;
	}
}
