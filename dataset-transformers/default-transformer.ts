import DatasetTransformer from "./dataset-transformer";
import jsstream from "stream";
import readline from "readline";
import { example, rdf } from "../utils/namespaces";
import { DataFactory, Store } from "n3";
import Resource from "../models/resource";
import { DatasetConfiguration } from "../utils/utils";
const { quad, literal, namedNode } = DataFactory;

interface DefaultDatasetConfiguration extends DatasetConfiguration {
	propertyType: string;
}

export default class DefaultTransformer implements DatasetTransformer {
	transform(
		input: jsstream.Readable,
		config: DefaultDatasetConfiguration
	): jsstream.Stream {
		const readLineInterface = readline.createInterface({
			input: input,
		});

		const resultStream = new jsstream.PassThrough({ objectMode: true });

		readLineInterface
			.on("line", async (input) => {
				let id = example(encodeURIComponent(input));
				let store = new Store([
					quad(id, rdf("type"), namedNode(config.resourceType)),
					quad(id, namedNode(config.propertyType), literal(input)),
				]);
				let resource = new Resource(id, store);
				resultStream.push(resource);
			})
			.once("close", () => {
				resultStream.emit("close");
			});
		return resultStream;
	}
}
