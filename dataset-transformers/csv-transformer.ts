import { Readable, Stream, PassThrough } from "stream";
import { DatasetConfiguration } from "../utils/utils";
import DatasetTransformer from "./dataset-transformer";
import csv from "csv-parser";
import { DataFactory, Store } from "n3";
import { rdf } from "../utils/namespaces";
import Resource from "../models/resource";
const { quad, literal, namedNode } = DataFactory;
interface CSVDatasetConfiguration extends DatasetConfiguration {
	resourceIdField: string;
	propertyMappings: object;
}

export default class CSVTransformer implements DatasetTransformer {
	transform(input: Readable, config: CSVDatasetConfiguration): Stream {
		const resultStream = new PassThrough({ objectMode: true });

		input
			.pipe(csv())
			.on("data", (data) => {
				let id = namedNode(
					encodeURI(
						config.resourceIdPrefix + data[config.resourceIdField]
					)
				);
				let store = new Store([
					quad(id, rdf("type"), namedNode(config.resourceType)),
				]);
				Object.entries(config.propertyMappings).forEach(
					([propertyName, predicateUri]) => {
						store.addQuad(
							id,
							namedNode(predicateUri),
							literal(data[propertyName])
						);
					}
				);
				let resource = new Resource(id, store);
				resultStream.push(resource);
			})
			.on("end", () => {
				resultStream.emit("close");
			});
		return resultStream;
	}
}
