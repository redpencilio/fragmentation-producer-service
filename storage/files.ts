import fs from "fs";
import {
	Quad,
	Store,
	DataFactory,
	NamedNode,
	Term,
	StreamParser,
	Quad_Object,
	Literal,
} from "n3";
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
import ttl_write from "@graphy/content.ttl.write";

import jsonld from 'jsonld';
import { FRAME } from "../utils/context-jsonld";
/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @return {Stream} Stream containing all triples which were downloaded.
 */


export async function convertToJsonLD(file: string): Promise<Object> {
	let quadStream = readTriplesStream(file);
	if (!quadStream) {
		throw Error(`File does not exist: ${file}`);
	}
	const quads = [];
	await new Promise<void>((resolve, reject) => {
		quadStream.on("data", quad => {
			quads.push(quad);
		})
		quadStream.on("error", reject); 
		quadStream.on("end", resolve);
	})
	// let quads = await createStore(quadStream);
	const jsonDoc = await jsonld.fromRDF(quads);
	const compactedJsonDoc = await jsonld.frame(jsonDoc, FRAME);
	return compactedJsonDoc;
}

export function readTriplesStream(file: string): jsstream.Readable | null {
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

async function createParentFolderIfNecessary(file) {
	if (!fs.existsSync(path.dirname(file))) {
		await new Promise<void>((resolve, reject) => {
			fs.mkdir(path.dirname(file), { recursive: true }, (err) => {
				if (err) reject(err);
				resolve();
			});
		});
	}
}
/**
 * Writes the triples in text-turtle to a file.
 *
 * @param {Store} store The store from which content will be written.
 * @param {NamedNode} graph The graph which will be written to the file.
 * @param {string} file Path of the file to which we will write the content.
 */
export async function writeTriplesStream(
	quadStream: jsstream.Readable,
	file: string
): Promise<void> {
	await createParentFolderIfNecessary(file);
	const turtleStream = quadStream.pipe(ttl_write());
	const writeStream = fs.createWriteStream(file);

	turtleStream.on("data", (turtleChunk) => {
		// turtleStream.pause();
		writeStream.write(turtleChunk);
		// turtleStream.resume();
	});
	return new Promise((resolve, reject) => {
		turtleStream.on("error", () => {
			console.log("error");
			reject();
		});
		turtleStream.on("end", () => {
			writeStream.end(() => {
				resolve();
			});
		});
	});
}

export async function readNodeStream(filePath: string): Promise<Node> {
	const triplesStream = readTriplesStream(filePath);
	if (!triplesStream) {
		throw Error(`File does not exist: ${filePath}`);
	}
	let id, stream, view;
	const relationIds = [];
	const memberIds = [];
	const content: Map<string, Map<string, RDF.Term[]>> = new Map();
	await new Promise((resolve, reject) => {
		triplesStream
			.on("data", (quad: RDF.Quad) => {
				// Detect if quad is metadata or content and store it in the right variables
				if (quad.predicate.equals(rdf("type"))) {
					if (
						quad.object.equals(ldes("EventStream")) ||
						quad.object.equals(tree("Collection"))
					) {
						// The quad represents the stream
						stream = quad.subject;
					} else if (quad.object.equals(tree("Node"))) {
						// The quad represents the node id
						id = quad.subject;
					} else {
						// Put other content of the node in a map with as key the subject and value a map mapping the predicates to objects
						let subject_value = quad.subject.value;
						if (!content.has(subject_value)) {
							const newMap: Map<string, RDF.Term[]> = new Map();
							content.set(subject_value, newMap);
						}
						if (
							content.get(subject_value).has(quad.predicate.value)
						) {
							content
								.get(subject_value)
								.get(quad.predicate.value)
								.push(quad.object);
						} else {
							content
								.get(subject_value)
								.set(quad.predicate.value, [quad.object]);
						}
					}
				} else if (quad.predicate.equals(tree("view"))) {
					// The quad represents a reference to the view (the root node in the tree)
					view = quad.object;
				} else if (quad.predicate.equals(tree("relation"))) {
					// The quad represents a relation to another node
					relationIds.push(quad.object);
				} else if (quad.predicate.equals(tree("member"))) {
					// The quad represents the id of a member of the node
					memberIds.push(quad.object);
				} else {
					// Put other content of the node in a map with as key the subject and value a map mapping the predicates to objects
					let subject_value = quad.subject.value;
					if (!content.has(subject_value)) {
						const newMap: Map<string, RDF.Term[]> = new Map();
						content.set(subject_value, newMap);
					}
					if (content.get(subject_value).has(quad.predicate.value)) {
						content
							.get(subject_value)
							.get(quad.predicate.value)
							.push(quad.object);
					} else {
						content
							.get(subject_value)
							.set(quad.predicate.value, [quad.object]);
					}
				}
			})
			.on("error", reject)
			.on("end", resolve);
	});

	if (id && stream && view) {
		let node = new Node(parseInt(path.parse(id.value).base), stream, view);
		// Add members and relations
		relationIds.forEach((relationId: RDF.NamedNode) => {
			if (content.has(relationId.value)) {
				const relationContent = content.get(relationId.value);
				let type = relationContent.get(rdf("type").value);
				let value = relationContent.get(tree("value").value);
				let target = relationContent.get(tree("node").value);
				let relationPath = relationContent.get(tree("path").value);
				if (
					type &&
					type.length &&
					value &&
					value.length &&
					target &&
					target.length &&
					relationPath &&
					relationPath.length
				) {
					const relation = new Relation(
						relationId,
						type[0] as NamedNode,
						value[0] as Literal,
						target[0] as NamedNode,
						parseInt(path.parse(target[0].value).base),
						relationPath[0] as NamedNode
					);

					node.add_relation(value[0].value, relation);
				}
			}
		});

		memberIds.forEach((memberId: RDF.NamedNode) => {
			let resource: Resource;
			if (content.has(memberId.value)) {
				resource = new Resource(memberId, content.get(memberId.value));
			} else {
				resource = new Resource(memberId);
			}
			node.add_member(resource);
		});
		return node;
	} else {
		throw Error(
			"Reference to id, stream or view not found in the requested file"
		);
	}
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
			let resource = new Resource(memberId as RDF.NamedNode);
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
	const quadStream = new jsstream.PassThrough({ objectMode: true });

	await createParentFolderIfNecessary(path);
	const turtleStream = quadStream.pipe(ttl_write());
	const writeStream = fs.createWriteStream(path);

	turtleStream.on("data", (turtleChunk) => {
		// turtleStream.pause();
		writeStream.write(turtleChunk);
		// turtleStream.resume();
	});

	quadStream.push(quad(node.stream, rdf("type"), ldes("EventStream")));
	quadStream.push(quad(node.stream, rdf("type"), tree("Collection")));
	quadStream.push(quad(node.stream, tree("view"), node.view));

	quadStream.push(quad(node.idNamedNode, rdf("type"), tree("Node")));

	// Add the different relations to the store
	for (const [_, relation] of Object.entries(node.relationsMap)) {
		quadStream.push(quad(node.idNamedNode, tree("relation"), relation.id));
		quadStream.push(quad(relation.id, rdf("type"), relation.type));
		quadStream.push(quad(relation.id, tree("value"), relation.value));
		quadStream.push(quad(relation.id, tree("node"), relation.target));
		quadStream.push(quad(relation.id, tree("path"), relation.path));
	}

	// Add the different members and their data to the store
	node.members.forEach((member) => {
		quadStream.push(quad(node.stream, tree("member"), member.id));
		member.dataMap.forEach((objects, predicateValue) => {
			objects.forEach((object) => {
				quadStream.push(
					quad(
						member.id,
						namedNode(predicateValue.toString()),
						object as Quad_Object
					)
				);
			});
		});
	});

	quadStream.push(null);

	// await writeTriplesStream(quadStream, path);

	return new Promise<void>((resolve, reject) => {
		turtleStream.on("error", () => {
			console.log("error");
			reject();
		});
		turtleStream.on("end", () => {
			writeStream.end(() => {
				resolve();
			});
		});
	});
}
