import { Readable, Stream, PassThrough } from "stream";
import { DatasetConfiguration } from "../utils/utils";
import DatasetTransformer from "./dataset-transformer";
import csv from "csv-parser";
import { DataFactory, Store } from "n3";
import { rdf } from "../utils/namespaces";
import Resource from "../models/resource";
const { quad, literal, namedNode } = DataFactory;
import dataFactory from "@rdfjs/data-model";
interface CSVDatasetConfiguration extends DatasetConfiguration {
	resourceIdField: string;
	propertyMappings: object;
}

export default class CSVTransformer implements DatasetTransformer {
	transform(input: Readable, config: CSVDatasetConfiguration): Readable {
		const resultStream = new PassThrough({ objectMode: true });

		input
			.pipe(csv())
			.on("data", (data) => {
				let id = namedNode(
					encodeURI(
						config.resourceIdPrefix + data[config.resourceIdField]
					)
				);

				let resource = new Resource(id);
				resource.addProperty(
					rdf("type").value,
					dataFactory.namedNode(config.resourceType)
				);
				Object.entries(config.propertyMappings).forEach(
					([propertyName, predicateUri]) => {
						resource.addProperty(
							predicateUri,
							dataFactory.literal(data[propertyName])
						);
					}
				);
				resultStream.push(resource);
			})
			.on("end", () => {
				resultStream.end();
			});
		return resultStream;
	}
}
