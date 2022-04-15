import { NamedNode, Store, DataFactory } from "n3";
const { quad, literal } = DataFactory;
import PrefixTreeFragmenter from "./fragmenters/PrefixTreeFragmenter";
import Node from "./models/node";
import PromiseQueue from "./promise-queue";
import { example, ldesTime, rdf } from "./utils/namespaces";
import fs from "fs";
import readline from "readline";
import Resource from "./models/resource";
const FOLDER = "/streetnames";

const UPDATE_QUEUE = new PromiseQueue<Node>();

const stream = ldesTime("street-stream");

const FRAGMENTER = new PrefixTreeFragmenter(
	"streetnames",
	stream,
	100,
	example("name")
);

export default function populateTree(): Promise<void> {
	const fileStream = fs.createReadStream("/datasets/straatnamen50.txt");
	const readLineInterface = readline.createInterface({
		input: fileStream,
	});

	return new Promise<void>((resolve, reject) =>
		readLineInterface
			.on("line", async (input) => {
				let id = example(input.replace(/ +/g, "_"));
				console.log(input);
				let store = new Store([
					quad(id, rdf("type"), example("Street")),
					quad(id, example("name"), literal(input)),
				]);
				let resource = new Resource(id, store);
				await UPDATE_QUEUE.push(() => FRAGMENTER.addResource(resource));
			})
			.once("close", () => {
				console.log("finished loading streets");
				resolve();
			})
	);
}
