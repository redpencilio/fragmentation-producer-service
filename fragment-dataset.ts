import { Command, Option } from "commander";
import { Store, DataFactory } from "n3";
const { quad, literal, namedNode } = DataFactory;
import PrefixTreeFragmenter from "./fragmenters/PrefixTreeFragmenter";
import Node from "./models/node";
import PromiseQueue from "./promise-queue";
import { example, ldesTime, rdf } from "./utils/namespaces";
import fs from "fs";
import Fragmenter from "./fragmenters/Fragmenter";
import TimeFragmenter from "./fragmenters/TimeFragmenter";
import DefaultTransformer from "./dataset-transformers/default-transformer";
import { DatasetConfiguration } from "./utils/utils";
import DatasetTransformer from "./dataset-transformers/dataset-transformer";
import CSVTransformer from "./dataset-transformers/csv-transformer";
import path from "path";

export type Newable<T> = { new (...args: any[]): T };

const fragmenterMap = new Map<String, Newable<Fragmenter>>();

fragmenterMap.set("time-fragmenter", TimeFragmenter);
fragmenterMap.set("prefix-tree-fragmenter", PrefixTreeFragmenter);

const transformerMap = new Map<String, DatasetTransformer>();
transformerMap.set(".csv", new CSVTransformer());

function getTransformer(extension: string): DatasetTransformer {
	return transformerMap.get(extension) || new DefaultTransformer();
}

const UPDATE_QUEUE = new PromiseQueue<Node>();

const program = new Command();

program
	.name("fragment-dataset")
	.description(
		"CLI tool to create a fragmented version of a provided dataset"
	);

program
	.argument("<dataset_file>", "The dataset which should be fragmented")
	.requiredOption(
		"-c, --config <config_file>",
		"JSON configuration file which describes how the dataset should be parsed"
	)
	.requiredOption(
		"-o, --output <output_folder>",
		"The destination folder in which the fragmented dataset should be stored"
	)
	.addOption(
		new Option(
			"-f, --fragmenter <fragmenter>",
			"The fragmenter which is to be used"
		)
			.choices([...fragmenterMap.keys()] as string[])
			.default("time-fragmenter")
	)
	.action(async (datasetFile, options) => {
		const fragmenterClass = fragmenterMap.get(options.fragmenter);
		console.log(options.config);
		const jsonData = fs.readFileSync(options.config, "utf8");
		const datasetConfig: DatasetConfiguration = JSON.parse(jsonData);
		if (fragmenterClass) {
			await fragmentDataset(
				datasetFile,
				datasetConfig,
				fragmenterClass,
				options.output
			);
		}
	});

program.parse();

export default function fragmentDataset(
	datasetFile: string,
	datasetConfiguration: DatasetConfiguration,
	fragmenterClass: Newable<Fragmenter>,
	outputFolder: string
): Promise<void> {
	const fragmenter = new fragmenterClass(
		outputFolder,
		namedNode(datasetConfiguration.stream),
		20,
		example("name")
	);
	const fileStream = fs.createReadStream(datasetFile);

	const transformer = getTransformer(path.extname(datasetFile));
	return new Promise<void>((resolve) => {
		transformer
			.transform(fileStream, datasetConfiguration)
			.on("data", async (resource) => {
				await UPDATE_QUEUE.push(() => fragmenter.addResource(resource));
			})
			.once("close", () => {
				console.log("finished loading resources");
				resolve();
			});
	});
}
