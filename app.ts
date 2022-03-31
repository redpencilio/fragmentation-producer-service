import { app, uuid, errorHandler } from "mu";
import bodyParser from "body-parser";
import rdfParser from "rdf-parse";
import rdfSerializer from "rdf-serialize";
import jsstream from "stream";
import { Store, DataFactory } from "n3";
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

import { readTriplesStream, lastPage, createStore } from "./storage/files.js";
import PromiseQueue from "./promise-queue.js";
import TimeFragmenter from "./fragmenters/TimeFragmenter.js";
import { countVersionedItems, error } from "./utils/utils.js";
import { ldesTime } from "./utils/namespaces.js";

const PAGES_FOLDER = "/data/pages";

const UPDATE_QUEUE = new PromiseQueue<Store>();

const stream = ldesTime("example-stream");

const FRAGMENTER = new TimeFragmenter(PAGES_FOLDER, stream, 10);

/**
 * Yields the file path on which the specified page number is described.
 *
 * @param {number} page Page index for which we want te get the file path.
 * @return {string} Path to the page.
 */
function fileForPage(page: number) {
  return `${PAGES_FOLDER}/${page}.ttl`;
}

app.post("/resource", async function (req: any, res: any, next: any) {
  try {
    console.log(rdfSerializer.getContentTypes);
    const contentTypes = await rdfParser.getContentTypes();
    if (!contentTypes.includes(req.headers["content-type"])) {
      return next(error(400, "Content-Type not recognized"));
    }

    const resource = namedNode(req.query.resource);

    const quadStream = rdfParser.parse(jsstream.Readable.from(req.body), {
      contentType: req.headers["content-type"],
    });

    const store = await createStore(quadStream);

    const currentDataset = await UPDATE_QUEUE.push(() =>
      FRAGMENTER.fragment(store, resource)
    );

    console.log(currentDataset);
    const newCount = countVersionedItems(currentDataset, stream);

    res.status(201).send(`{"message": "ok", "triplesInPage": ${newCount}}`);
  } catch (e) {
    console.error(e);
    return next(error(500));
  }
});

app.get("/pages", async function (req: any, res: any, next: any) {
  try {
    const page = parseInt(req.query.page);

    if (page > lastPage(PAGES_FOLDER)) {
      return next(error(404, "Page not found"));
    }

    const contentTypes = await rdfSerializer.getContentTypes();

    const contentType = req.accepts(contentTypes);
    console.log(contentType);
    if (!contentType) {
      return next(error(406));
    }

    if (page < lastPage(PAGES_FOLDER))
      res.header("Cache-Control", "public, immutable");

    const rdfStream = readTriplesStream(fileForPage(page));

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

    const file = fileForPage(page);
    console.log(`Reading from ${file}`);

    const currentDataset = await createStore(readTriplesStream(file));

    const count = countVersionedItems(currentDataset, stream);
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

app.use(errorHandler);
