import { app, uuid, errorHandler } from 'mu';

import fs from 'fs';
import { parse, graph, namedNode, triple, literal, Formula, serialize } from 'rdflib';
import bodyParser from 'body-parser';

app.use(bodyParser.text({
  type: function(req) {
    return true;
  }
}));

const FILE = '/app/data/feed.ttl';
const GRAPH_STR = "http://mu.semte.ch/services/ldes-time-fragmenter";
const GRAPH = namedNode(GRAPH_STR);

const stream = namedNode("http://mu.semte.ch/services/ldes-time-fragmenter/example-stream");

function generateVersion(_namedNode) {
  return `http://mu.semte.ch/services/ldes-time-fragmenter/versioned/${uuid()}`;
}

function triplesFileAsString() {
  return fs.readFileSync(FILE, 'utf8');
}

function readTriples() {
  const newGraph = graph();
  parse(triplesFileAsString(), newGraph, GRAPH_STR, "text/turtle");
  return newGraph;
}

function writeTriples(dataset) {
  fs.writeFileSync(FILE, serialize(GRAPH, dataset, 'text/turtle'));
}

async function turtleParseString(string) {
  const newGraph = graph();
  parse(string, newGraph, "http://example.com/", "text/turtle");
  return newGraph;
}

function nowLiteral() {
  const xsdDateTime = namedNode('http://www.w3.org/2001/XMLSchema#dateTime');
  const now = (new Date()).toISOString();
  return literal(now, xsdDateTime);
}

/**
 * Publishes a new version of the same resource.
 */
app.post('/resource', async (req, res) => {
  try {
    const body = await turtleParseString(req.body);
    const resource = namedNode(req.query.resource);
    const versionedResource = namedNode(generateVersion(resource));

    const newTriples = graph();

    // create new version of the resource
    for (let match of body.match()) {
      let quad = triple(
        match.subject.sameTerm(resource) ? versionedResource : match.subject,
        match.predicate.sameTerm(resource) ? versionedResource : match.predicate,
        match.object.sameTerm(resource) ? versionedResource : match.object,
        GRAPH
      );

      newTriples.add(quad);
    }

    // add resources about this version
    newTriples.add(triple(
      versionedResource,
      namedNode("http://purl.org/dc/terms/isVersionOf"),
      resource,
      GRAPH));
    newTriples.add(triple(
      versionedResource,
      namedNode("http://www.w3.org/ns/sosa/resultTime"),
      nowLiteral(),
      GRAPH
    ));
    newTriples.add(triple(
      stream,
      namedNode("https://w3id.org/tree#member"),
      versionedResource,
      GRAPH
    ));

    // merge the old and the new dataset
    const currentDataset = readTriples();
    currentDataset.addAll(newTriples.match());

    // write out the triples
    writeTriples(currentDataset);
    res.status(200).send('{"message": "ok"}');
  } catch (e) {
    console.error(e);
    res.status(500).send();
  }
});

app.get('/', function(_req, res) {
  try {
    res
      .header('Content-Type', 'text/turtle')
      .status(200)
      .send(triplesFileAsString());
  } catch (e) {
    console.error(e);
  }
});

app.use(errorHandler);
