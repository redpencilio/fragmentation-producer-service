import { Readable, PassThrough } from "stream";
import { DatasetConfiguration } from "../utils/utils";
import DatasetTransformer from "./dataset-transformer";
import readline from "readline";
import { example, rdf } from "../utils/namespaces";
import { DataFactory, Store } from "n3";
import Resource from "../models/resource";
import { DefaultDatasetConfiguration } from "./default-transformer";
const { quad, literal, namedNode } = DataFactory;

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
				const id = namedNode(
					encodeURI(config.resourceIdPrefix + list[0])
				);
				let store = new Store([
					quad(id, rdf("type"), namedNode(config.resourceType)),
					quad(id, namedNode(config.propertyType), literal(list[1])),
				]);
				let resource = new Resource(id, store);
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
