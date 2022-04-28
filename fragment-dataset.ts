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
import { DatasetConfiguration, Newable } from "./utils/utils";
import DatasetTransformer from "./dataset-transformers/dataset-transformer";
import CSVTransformer from "./dataset-transformers/csv-transformer";
import path from "path";
import { IPFSIndexTransformer } from "./dataset-transformers/ipfs-index-transformer";

const fragmenterMap = new Map<String, Newable<Fragmenter>>();

fragmenterMap.set("time-fragmenter", TimeFragmenter);
fragmenterMap.set("prefix-tree-fragmenter", PrefixTreeFragmenter);

const transformerMap = new Map<String, DatasetTransformer>();
transformerMap.set("csv-transformer", new CSVTransformer());
transformerMap.set("default-transformer", new DefaultTransformer());
transformerMap.set("ipfs-transformer", new IPFSIndexTransformer());

const extensionMap = new Map<String, DatasetTransformer>();
extensionMap.set(".csv", new CSVTransformer());

function getTransformer(extension: string): DatasetTransformer {
	return extensionMap.get(extension) || new DefaultTransformer();
}

const UPDATE_QUEUE = new PromiseQueue<Node | void>();

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
	.addOption(
		new Option(
			"-t, --transformer <dataset_transformer>",
			"The dataset transformer which should be applied, overrides automatic selection of transformer based on file extension"
		).choices([...transformerMap.keys()] as string[])
	)
	.action(async (datasetFile, options) => {
		const fragmenterClass = fragmenterMap.get(options.fragmenter);
		console.log(options.config);
		const jsonData = fs.readFileSync(options.config, "utf8");
		const datasetConfig: DatasetConfiguration = JSON.parse(jsonData);
		let transformer: DatasetTransformer;
		if (options.transformer) {
			transformer = transformerMap.get(options.transformer)!;
		} else {
			transformer = getTransformer(path.extname(datasetFile));
		}
		if (fragmenterClass) {
			await fragmentDataset(
				transformer,
				datasetFile,
				datasetConfig,
				fragmenterClass,
				options.output
			);
		}
	});

program.parse();

export default function fragmentDataset(
	transformer: DatasetTransformer,
	datasetFile: string,
	datasetConfiguration: DatasetConfiguration,
	fragmenterClass: Newable<Fragmenter>,
	outputFolder: string
): Promise<void> {
	const fragmenter = new fragmenterClass(
		outputFolder,
		namedNode(datasetConfiguration.stream),
		100,
		example("name"),
		20,
		5
	);
	const fileStream = fs.createReadStream(datasetFile);

	return new Promise<void>((resolve) => {
		const transformedStream = transformer.transform(
			fileStream,
			datasetConfiguration
		);
		let i = 0;
		console.log(i);
		transformedStream
			.on("data", async (resource) => {
				transformedStream.pause();
				i += 1;
				console.log(`\r${i}`);

				if (i % 10000 === 0) {
					await UPDATE_QUEUE.push(() => fragmenter.cache.flush());
				}

				await UPDATE_QUEUE.push(() => fragmenter.addResource(resource));
				transformedStream.resume();
			})
			.on("close", async () => {
				console.log("finished loading resources");
				await UPDATE_QUEUE.push(() => fragmenter.cache.flush());
				resolve();
			});
	});
}
