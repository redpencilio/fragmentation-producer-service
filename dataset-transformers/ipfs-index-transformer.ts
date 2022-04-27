import { Readable, PassThrough } from "stream";
import { DatasetConfiguration } from "../utils/utils";
import DatasetTransformer from "./dataset-transformer";
import readline from "readline";
import { example, rdf } from "../utils/namespaces";
import { DataFactory, Store } from "n3";
import Resource from "../models/resource";
import { DefaultDatasetConfiguration } from "./default-transformer";
const { quad, literal, namedNode } = DataFactory;
import dataFactory from "@rdfjs/data-model";

export class IPFSIndexTransformer implements DatasetTransformer {
	transform(input: Readable, config: DefaultDatasetConfiguration): Readable {
		const readLineInterface = readline.createInterface({
			input: input,
		});

		const resultStream = new PassThrough({ objectMode: true });

		readLineInterface
			.on("line", async (input) => {
				readLineInterface.pause();
				const list = JSON.parse(input);
				const id = dataFactory.namedNode(
					encodeURI(config.resourceIdPrefix + list[0])
				);
				let store = new Store([
					quad(
						id,
						rdf("type"),
						dataFactory.namedNode(config.resourceType)
					),
					quad(
						id,
						dataFactory.namedNode(config.propertyType),
						dataFactory.literal(list[1])
					),
				]);
				let resource = new Resource(id, store);
				resource.addProperty(
					rdf("type").value,
					dataFactory.namedNode(config.resourceType)
				);
				resource.addProperty(
					config.propertyType,
					dataFactory.literal(list[1])
				);
				resultStream.push(resource);
				readLineInterface.resume();
			})
			.on("close", () => {
				resultStream.end();
			});
		resultStream.on("pause", () => {
			readLineInterface.pause();
		});
		resultStream.on("resume", () => {
			readLineInterface.resume();
		});
		return resultStream;
	}
}
