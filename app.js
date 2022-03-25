import { app, uuid, errorHandler } from "mu";
import bodyParser from "body-parser";
import rdfParser from "rdf-parse";
import rdfSerializer from "rdf-serialize";
import fs from "fs";

app.use(
  bodyParser.text({
    type: function (req) {
      return true;
    },
  })
);

import {
  readTriples,
  writeTriples,
  triplesFileAsString,
  lastPage,
  clearLastPageCache,
} from "./storage/files";
import {
  parse,
  graph,
  namedNode,
  triple,
  literal,
  Store,
  NamedNode,
} from "rdflib";

const FEED_FILE = "/app/data/feed.ttl";
const PAGES_FOLDER = "/app/data/pages/";
const GRAPH = namedNode("http://mu.semte.ch/services/ldes-time-fragmenter");
const MAX_RESOURCES_PER_PAGE = 10;
const SERVICE_PATH = "http://localhost:8888/"; // a workaround for json-ld not accepting relative paths

const stream = namedNode(
  "http://mu.semte.ch/services/ldes-time-fragmenter/example-stream"
);

function generateVersion(_namedNode) {
  return namedNode(
    `http://mu.semte.ch/services/ldes-time-fragmenter/versioned/${uuid()}`
  );
}

function generateTreeRelation() {
  return namedNode(
    `http://mu.semte.ch/services/ldes-time-fragmenter/relations/${uuid()}`
  );
}

function generatePageResource(number) {
  return namedNode(`${SERVICE_PATH}pages?page=${number}`);
}

function parseString(string, contentType) {
  console.log(string);
  let newGraph = graph();
  parse(string, newGraph, "http://example.com/", contentType);
  console.log(result.statements);
  // console.log(newGraph.statements);
  return newGraph;
}

function nowLiteral() {
  const xsdDateTime = namedNode("http://www.w3.org/2001/XMLSchema#dateTime");
  const now = new Date().toISOString();
  return literal(now, xsdDateTime);
}

/**
 * Yields the file path on which the specified page number is described.
 *
 * @param {number} page Page index for which we want te get the file path.
 * @return {string} Path to the page.
 */
function fileForPage(page) {
  return `${PAGES_FOLDER}${page}.ttl`;
}

/**
 * Yield the amount of solutions in the specified graph of the store.
 *
 * @param {Store} store Store containing all the triples.
 * @param {NamedNode} graph The graph containing the data.
 */
function countVersionedItems(store, graph) {
  return store.match(
    stream,
    namedNode("https://w3id.org/tree#member"),
    undefined,
    graph
  ).length;
}

/**
 * Indicates whether or not we should create a new page.
 *
 * @param {Store} store Store which contains parsed triples.
 * @param {NamedNode} graph Graph in which current triples are stored.
 * @return {boolean} Truethy if we should create a new file.
 */
function shouldCreateNewPage(store, graph) {
  return countVersionedItems(store, graph) >= MAX_RESOURCES_PER_PAGE;
}

/**
 * Publishes a new version of the same resource.
 */
app.post("/resource", (req, res) => {
  try {
    const contentType = req.headers["content-type"];
    const body = parseString(req.body, contentType);
    console.log(body.match());
    const resource = namedNode(req.query.resource);
    const versionedResource = generateVersion(resource);
    const newTriples = graph();

    // create new version of the resource
    for (let match of body.match()) {
      let quad = triple(
        match.subject.sameTerm(resource) ? versionedResource : match.subject,
        match.predicate.sameTerm(resource)
          ? versionedResource
          : match.predicate,
        match.object.sameTerm(resource) ? versionedResource : match.object,
        GRAPH
      );

      newTriples.add(quad);
    }

    const dateLiteral = nowLiteral();

    // add resources about this version
    newTriples.add(
      triple(
        versionedResource,
        namedNode("http://purl.org/dc/terms/isVersionOf"),
        resource,
        GRAPH
      )
    );
    newTriples.add(
      triple(
        versionedResource,
        namedNode("http://www.w3.org/ns/sosa/resultTime"),
        dateLiteral,
        GRAPH
      )
    );
    newTriples.add(
      triple(
        stream,
        namedNode("https://w3id.org/tree#member"),
        versionedResource,
        GRAPH
      )
    );

    // read the current dataset
    const lastPageNr = lastPage(PAGES_FOLDER);
    let pageFile = fileForPage(lastPageNr);
    let currentDataset = readTriples(pageFile, GRAPH);

    if (shouldCreateNewPage(currentDataset, GRAPH)) {
      const closingDataset = currentDataset;

      // link the current dataset to the new dataset but don't save yet
      const closingPageFile = pageFile;
      const nextPageFile = fileForPage(lastPageNr + 1);
      const relationResource = generateTreeRelation();
      const currentPageResource = generatePageResource(lastPageNr);
      const nextPageResource = generatePageResource(lastPageNr + 1);
      closingDataset.add(
        triple(
          currentPageResource,
          namedNode("https://w3id.org/tree#relation"),
          relationResource,
          GRAPH
        )
      );
      closingDataset.add(
        triple(
          relationResource,
          namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
          namedNode("https://w3id.org/tree#GreaterThanOrEqualRelation"),
          GRAPH
        )
      );
      closingDataset.add(
        triple(
          relationResource,
          namedNode("https://w3id.org/tree#node"),
          nextPageResource,
          GRAPH
        )
      );
      closingDataset.add(
        triple(
          relationResource,
          namedNode("https://w3id.org/tree#path"),
          namedNode("http://www.w3.org/ns/sosa/resultTime"),
          GRAPH
        )
      );
      closingDataset.add(
        triple(
          relationResource,
          namedNode("https://w3id.org/tree#value"),
          dateLiteral,
          GRAPH
        )
      );

      // create a store with the new graph for the new file
      currentDataset = readTriples(FEED_FILE, GRAPH);
      currentDataset.add(
        triple(
          nextPageResource,
          namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
          namedNode("https://w3id.org/tree#Node"),
          GRAPH
        )
      );
      currentDataset.addAll(newTriples.match());

      // Write out new dataset to nextPageFile
      writeTriples(currentDataset, GRAPH, nextPageFile);
      // Write out closing dataset to closingPageFile
      writeTriples(closingDataset, GRAPH, closingPageFile);
      // Clear the last page cache
      clearLastPageCache(PAGES_FOLDER);
    } else {
      currentDataset.addAll(newTriples.match());
      writeTriples(currentDataset, GRAPH, pageFile);
    }

    const newCount = countVersionedItems(currentDataset, GRAPH);

    res.status(200).send(`{"message": "ok", "triplesInPage": ${newCount}}`);
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get("/", function (_req, res) {
  // LDES does not use this index page
  try {
    res
      .header("Content-Type", "text/turtle")
      .status(200)
      .send(triplesFileAsString(FEED_FILE));
  } catch (e) {
    console.error(e);
  }
});

app.get("/pages", function (req, res) {
  try {
    const page = parseInt(req.query.page);

    if (page < lastPage(PAGES_FOLDER))
      res.header("Cache-Control", "public, immutable");

    if (req.accepts("application/ld+json")) {
      const fileStream = fs.createReadStream(fileForPage(page));
      const rdfStream = rdfParser.parse(fileStream, {
        contentType: "text/turtle",
      });

      rdfSerializer
        .serialize(rdfStream, {
          contentType: "application/ld+json",
        })
        .on("data", (d) => res.write(d))
        .on("error", (error) => console.log(error))
        .on("end", () => res.end());
    } else {
      res
        .header("Content-Type", "text/turtle")
        .status(200)
        .send(triplesFileAsString(fileForPage(page)));
    }
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get("/count", function (_req, res) {
  try {
    const file = fileForPage(lastPage(PAGES_FOLDER));
    console.log(`Reading from ${file}`);
    const currentDataset = readTriples(file, GRAPH);
    const count = countVersionedItems(currentDataset, GRAPH);
    res.status(200).send(`{"count": ${count}}`);
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get("/last-page", function (_req, res) {
  try {
    const page = lastPage(PAGES_FOLDER);
    if (page === NaN) res.status(500).send(`{"message": "No pages found"}`);
    else res.status(200).send(`{"lastPage": ${page}}`);
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.use(errorHandler);
