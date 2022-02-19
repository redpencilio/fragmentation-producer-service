import { app, uuid, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { NamedNode } from 'rdflib';

app.use(bodyParser.text({
  type: function(req) {
    return true;
  }
}));

import { readTriples, writeTriples, triplesFileAsString } from './storage/files';
import { parse, graph, namedNode, triple, literal } from 'rdflib';

const FILE = '/app/data/feed.ttl';
const GRAPH = namedNode("http://mu.semte.ch/services/ldes-time-fragmenter");

const stream = namedNode("http://mu.semte.ch/services/ldes-time-fragmenter/example-stream");

function generateVersion(_namedNode) {
  return `http://mu.semte.ch/services/ldes-time-fragmenter/versioned/${uuid()}`;
}

function turtleParseString(string) {
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
 * Yield the amount of solutions in the specified graph of the store.
 *
 * @param {Store} store Store containing all the triples.
 * @param {NamedNode} graph The graph containing the data.
 */
function countVersionedItems(store, graph) {
  return store
    .match(
      stream,
      namedNode("https://w3id.org/tree#member"),
      undefined,
      graph)
    .length;
}

/**
 * Publishes a new version of the same resource.
 */
app.post('/resource', (req, res) => {
  try {
    const body = turtleParseString(req.body);
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
    const currentDataset = readTriples(FILE, GRAPH);
    currentDataset.addAll(newTriples.match());

    // write out the triples
    writeTriples(currentDataset, GRAPH, FILE);
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
      .send(triplesFileAsString(FILE));
  } catch (e) {
    console.error(e);
  }
});

app.get('/count', function(_req, res) {
  try {
    const currentDataset = readTriples(FILE, GRAPH);
    const count = countVersionedItems(currentDataset, GRAPH);
    res.status(200).send(`{"count": ${count}}`);
  } catch (e) {
    console.error(e);
  }
});

app.use(errorHandler);
