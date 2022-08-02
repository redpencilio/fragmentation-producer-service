import DatasetTransformer, {
	DatasetConfiguration,
} from "./dataset-transformer";
import { Readable } from "stream";
import rdfParser from "rdf-parse";

import { createStore } from "../storage/files";
import { RDF } from "../utils/namespaces";
import { DataFactory, NamedNode, Store } from "n3";
import Resource from "../models/resource";
const { namedNode } = DataFactory;
export interface RDFDatasetConfiguration extends DatasetConfiguration {
	datatype: string;
}

async function* getResources(store: Store, resourceType: string) {
	const matches = store.getSubjects(
		RDF("type"),
		namedNode(resourceType),
		null
	);
	for (const resourceId of matches) {
		const resourceStore = store.match(resourceId, null, null);
		const resource = new Resource(resourceId as NamedNode);
		for (const quad of resourceStore) {
			resource.addProperty(quad.predicate.value, quad.object);
		}
		yield resource;
	}
}

export default class RDFTransformer implements DatasetTransformer {
	async transform(
		input: Readable,
		config: RDFDatasetConfiguration
	): Promise<Readable> {
		const quadStream = rdfParser.parse(input, {
			contentType: config.datatype,
		});

		const store = await createStore(quadStream);

		return Readable.from(getResources(store, config.resourceType));
	}
}
