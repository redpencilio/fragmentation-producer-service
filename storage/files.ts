import fs from "fs";
import { Quad, Store, DataFactory, NamedNode, Term, StreamParser } from "n3";
const { quad, namedNode } = DataFactory;
import rdfSerializer from "rdf-serialize";
import jsstream from "stream";
import * as RDF from "rdf-js";
import Node from "../models/node";
import { getFirstMatch } from "../utils/utils";
import { ldes, rdf, tree } from "../utils/namespaces";
import Resource from "../models/resource";
import Relation from "../models/relation";
import path from "path";
import ttl_read from "@graphy/content.ttl.read";

/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @return {Stream} Stream containing all triples which were downloaded.
 */

export function readTriplesStream(file: string): RDF.Stream<Quad> | null {
	if (!fs.existsSync(file)) {
		return null;
	}
	const fileStream = fs.createReadStream(file);

	return fileStream.pipe(ttl_read());
}

export function createStore(quadStream: RDF.Stream<Quad>): Promise<Store> {
	const store = new Store();
	return new Promise((resolve, reject) =>
		store
			.import(quadStream)
			.on("error", reject)
			.once("end", () => resolve(store))
	);
}
/**
 * Writes the triples in text-turtle to a file.
 *
 * @param {Store} store The store from which content will be written.
 * @param {NamedNode} graph The graph which will be written to the file.
 * @param {string} file Path of the file to which we will write the content.
 */
export async function writeTriplesStream(
	store: Store,
	file: string
): Promise<void> {
	const quadStream = jsstream.Readable.from(store);
	const turtleStream = rdfSerializer.serialize(quadStream, {
		contentType: "text/turtle",
	});
	if (!fs.existsSync(path.dirname(file))) {
		await new Promise<void>((resolve, reject) => {
			fs.mkdir(path.dirname(file), { recursive: true }, (err) => {
				if (err) reject(err);
				resolve();
			});
		});
	}

	const writeStream = fs.createWriteStream(file);

	turtleStream.on("data", (turtleChunk) => {
		turtleStream.pause();
		writeStream.write(turtleChunk);
		turtleStream.resume();
	});
	return new Promise((resolve, reject) => {
		turtleStream.on("error", reject);
		turtleStream.on("end", () => {
			writeStream.end(() => {
				resolve();
			});
		});
	});
}

export async function readNode(filePath: string): Promise<Node> {
	const triplesStream = readTriplesStream(filePath);
	if (!triplesStream) {
		throw Error("File does not exist");
	}
	let store = await createStore(triplesStream);

	let id = getFirstMatch(store, null, rdf("type"), tree("Node"))?.subject;
	const stream = getFirstMatch(
		store,
		null,
		rdf("type"),
		ldes("EventStream")
	)?.subject;
	let view = getFirstMatch(store, null, tree("view"))?.object;
	if (id && stream && view) {
		let node: Node = new Node(
			parseInt(path.parse(id.value).base),
			stream as RDF.NamedNode,
			view as RDF.NamedNode
		);

		// Read relations from store and add them to the node
		const relationIds = store
			.getQuads(id, tree("relation"), null, null)
			.map((quad) => quad.object);

		relationIds.forEach((relationId) => {
			let type = getFirstMatch(store, relationId, rdf("type"))?.object;

			let value = getFirstMatch(store, relationId, tree("value"))?.object;

			let target = getFirstMatch(store, relationId, tree("node"))?.object;

			let relationPath = getFirstMatch(
				store,
				relationId,
				tree("path")
			)?.object;

			if (type && value && target && relationPath) {
				node.add_relation(
					value.value,
					new Relation(
						relationId as RDF.NamedNode,
						type as RDF.NamedNode,
						value as RDF.Literal,
						target as RDF.NamedNode,
						parseInt(path.parse(target.value).base),
						relationPath as RDF.NamedNode
					)
				);
			}
		});
		// Read members from store and add them to the node
		const memberIds = store
			.getQuads(null, tree("member"), null, null)
			.map((quad) => quad.object);
		memberIds.forEach((memberId) => {
			let content = new Store(store.getQuads(memberId, null, null, null));
			let resource = new Resource(memberId as RDF.NamedNode, content);
			content.forEach(
				(quad) => {
					resource.addProperty(quad.predicate.value, quad.object);
				},
				null,
				null,
				null,
				null
			);
			node.add_member(resource);
		});

		return node;
	} else {
		throw Error(
			"Reference to id, stream or view not found in the requested file"
		);
	}
}

export async function writeNode(node: Node, path: string) {
	let store = new Store();

	// Add stream and its view property
	store.addQuads([
		quad(node.stream, rdf("type"), ldes("EventStream")),
		quad(node.stream, rdf("type"), tree("Collection")),
		quad(node.stream, tree("view"), node.view),
	]);

	// Add node id
	store.add(quad(node.idNamedNode, rdf("type"), tree("Node")));

	// Add the different relations to the store
	node.relationsMap.forEach((relation) => {
		store.add(quad(node.idNamedNode, tree("relation"), relation.id));
		store.addQuads([
			quad(relation.id, rdf("type"), relation.type),
			quad(relation.id, tree("value"), relation.value),
			quad(relation.id, tree("node"), relation.target),
			quad(relation.id, tree("path"), relation.path),
		]);
	});

	// Add the different members and their data to the store
	node.members.forEach((member) => {
		store.add(quad(node.stream, tree("member"), member.id));
		store.addQuads(member.data.getQuads(null, null, null, null));
	});

	await writeTriplesStream(store, path);
}
