import { Command, Option } from "commander";
import { Store, DataFactory } from "n3";
const { quad, literal } = DataFactory;
import PrefixTreeFragmenter from "./fragmenters/PrefixTreeFragmenter";
import Node from "./models/node";
import PromiseQueue from "./promise-queue";
import { example, ldesTime, rdf } from "./utils/namespaces";
import fs from "fs";
import readline from "readline";
import Resource from "./models/resource";
import Fragmenter from "./fragmenters/Fragmenter";
import TimeFragmenter from "./fragmenters/TimeFragmenter";

export type Newable<T> = { new (...args: any[]): T };

const fragmenterMap = new Map<String, Newable<Fragmenter>>();

fragmenterMap.set("time-fragmenter", TimeFragmenter);
fragmenterMap.set("prefix-tree-fragmenter", PrefixTreeFragmenter);

const UPDATE_QUEUE = new PromiseQueue<Node>();

const stream = ldesTime("street-stream");
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
		const datasetConfig = JSON.parse(jsonData);
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
	datasetConfiguration: object,
	fragmenterClass: Newable<Fragmenter>,
	outputFolder: string
): Promise<void> {
	console.log("fragment");
	const fragmenter = new fragmenterClass(
		outputFolder,
		stream,
		10,
		example("name")
	);
	const fileStream = fs.createReadStream(datasetFile);
	const readLineInterface = readline.createInterface({
		input: fileStream,
	});

	return new Promise<void>((resolve) =>
		readLineInterface
			.on("line", async (input) => {
				let id = example(encodeURIComponent(input));
				let store = new Store([
					quad(id, rdf("type"), example("Street")),
					quad(id, example("name"), literal(input)),
				]);
				let resource = new Resource(id, store);
				await UPDATE_QUEUE.push(() => fragmenter.addResource(resource));
			})
			.once("close", () => {
				console.log("finished loading streets");
				resolve();
			})
	);
}
