import { NamedNode, Store } from "n3";

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
	abstract constructPageTemplate(): Store;

	fileForPage(pageNr: number): string {
		return `${this.folder}/${pageNr}.ttl`;
	}

	shouldCreateNewPage(store: Store): boolean {
		return (
			countVersionedItems(store, this.stream) >= this.maxResourcesPerPage
		);
	}

	abstract addResource(
		resource_id: NamedNode,
		resource_data: Store
	): Promise<Store>;
}
