import { app, uuid, errorHandler } from "mu";
import bodyParser from "body-parser";
import rdfParser from "rdf-parse";
import rdfSerializer from "rdf-serialize";
import jsstream from "stream";
import { Store, DataFactory, NamedNode } from "n3";
import cors from "cors";
const { namedNode } = DataFactory;
app.use(cors());
app.use(
	bodyParser.text({
		type: function (req: any) {
			return true;
		},
	})
);

import {
	readTriplesStream,
	lastPage,
	createStore,
	readNode,
} from "./storage/files";
import PromiseQueue from "./promise-queue";
import TimeFragmenter from "./fragmenters/TimeFragmenter";
import { error, getFirstMatch } from "./utils/utils";
import { ldesTime } from "./utils/namespaces";
import Resource from "./models/resource";
import Node from "./models/node";
import PrefixTreeFragmenter from "./fragmenters/PrefixTreeFragmenter";
import populateTree from "./populateStreetNameTree";

const PAGES_FOLDER = "/data/pages";

const UPDATE_QUEUE = new PromiseQueue<Node>();

const stream = ldesTime("example-stream");

const FRAGMENTER = new PrefixTreeFragmenter(
	"/pagesPrefix",
	stream,
	10,
	new NamedNode("http://mu.semte.ch/services/tests/name")
);

/**
 * Yields the file path on which the specified page number is described.
 *
 * @param {number} page Page index for which we want te get the file path.
 * @return {string} Path to the page.
 */
function fileForPage(folder: string, page: number) {
	return `${folder}/${page}.ttl`;
}

app.post("/resource", async function (req: any, res: any, next: any) {
	try {
		console.log(rdfSerializer.getContentTypes);
		const contentTypes = await rdfParser.getContentTypes();
		if (!contentTypes.includes(req.headers["content-type"])) {
			return next(error(400, "Content-Type not recognized"));
		}

		const quadStream = rdfParser.parse(jsstream.Readable.from(req.body), {
			contentType: req.headers["content-type"],
		});
		const store = await createStore(quadStream);
		const resource = new Resource(namedNode(req.query.resource), store);

		const currentDataset = await UPDATE_QUEUE.push(() =>
			FRAGMENTER.addResource(resource)
		);

		res.status(201).send(
			`{"message": "ok", "triplesInPage": ${currentDataset.count()}}`
		);
	} catch (e) {
		console.error(e);
		return next(error(500));
	}
});

app.get("/:folder/:nodeId", async function (req: any, res: any, next: any) {
	try {
		const page = parseInt(req.params.nodeId);
		const pagesFolder = `/data/${req.params.folder}`;
		if (page > lastPage(pagesFolder)) {
			return next(error(404, "Page not found"));
		}

		const contentTypes = await rdfSerializer.getContentTypes();

		const contentType = req.accepts(contentTypes);
		console.log(contentType);
		if (!contentType) {
			return next(error(406));
		}

		if (page < lastPage(pagesFolder))
			res.header("Cache-Control", "public, immutable");

		const rdfStream = readTriplesStream(fileForPage(pagesFolder, page));

		res.header("Content-Type", contentType);

		rdfSerializer
			.serialize(rdfStream, {
				contentType: contentType,
			})
			.on("data", (d) => res.write(d))
			.on("error", (error) => {
				next(error(500, "Serializing error"));
			})
			.on("end", () => {
				res.end();
			});
	} catch (e) {
		console.error(e);
		return next(error(500));
	}
});

app.get("/count", async function (_req: any, res: any, next: any) {
	try {
		const page = lastPage(PAGES_FOLDER);
		if (page === NaN) return next(error(404, "No pages found"));

		const file = fileForPage(PAGES_FOLDER, page);
		console.log(`Reading from ${file}`);
		const currentNode = await readNode(file);
		console.log(currentNode.id);
		const count = currentNode.count();
		res.status(200).send(`{"count": ${count}}`);
	} catch (e) {
		console.error(e);
		return next(error(500));
	}
});

app.get("/last-page", function (_req: any, res: any, next: any) {
	try {
		const page = lastPage(PAGES_FOLDER);
		if (page === NaN) return next(error(404, "No pages found"));
		else res.status(200).send(`{"lastPage": ${page}}`);
	} catch (e) {
		console.error(e);
		return next(error(500));
	}
});

app.get("/populate-street-db", async function (req: any, res: any, next: any) {
	try {
		await populateTree();
		res.status(200).send();
	} catch (e) {
		console.error(e);
		return next(error(500));
	}
});

app.use(errorHandler);
