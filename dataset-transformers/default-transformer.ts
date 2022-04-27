import DatasetTransformer from "./dataset-transformer";
import { Readable, Stream, PassThrough } from "stream";

import readline from "readline";
import { example, rdf } from "../utils/namespaces";
import { DataFactory, Store } from "n3";
import Resource from "../models/resource";
import { DatasetConfiguration } from "../utils/utils";
const { quad, literal, namedNode } = DataFactory;

export interface DefaultDatasetConfiguration extends DatasetConfiguration {
	propertyType: string;
}

export default class DefaultTransformer implements DatasetTransformer {
	transform(input: Readable, config: DefaultDatasetConfiguration): Readable {
		const readLineInterface = readline.createInterface({
			input: input,
		});

		const resultStream = new PassThrough({ objectMode: true });

		readLineInterface
			.on("line", async (input) => {
				let id = namedNode(encodeURI(config.resourceIdPrefix + input));
				let store = new Store([
					quad(id, rdf("type"), namedNode(config.resourceType)),
					quad(id, namedNode(config.propertyType), literal(input)),
				]);
				let resource = new Resource(id, store);
				resource.addProperty(
					rdf("type").value,
					namedNode(config.resourceType)
				);
				resource.addProperty(config.propertyType, literal(input));
				resultStream.push(resource);
			})
			.on("close", () => {
				resultStream.end();
			});
		return resultStream;
	}
}
