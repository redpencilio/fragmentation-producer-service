import { Term } from "n3";
import Relation from "./relation";
import Resource from "./resource";
import * as RDF from "rdf-js";

export default class Node {
	id: RDF.NamedNode;
	members: Set<Resource> = new Set();
	relations: Relation[] = [];
	view: RDF.NamedNode;
	stream: RDF.NamedNode;

	constructor(id: RDF.NamedNode, stream: RDF.NamedNode, view: RDF.NamedNode) {
		this.id = id;
		this.stream = stream;
		this.view = view;
	}

	add_member(resource: Resource) {
		this.members.add(resource);
	}

	add_relation(relation: Relation) {
		this.relations.push(relation);
	}

	add_members(resources: Resource[]) {
		resources.forEach((resource) => this.members.add(resource));
	}

	delete_members(resources: Resource[]) {
		resources.forEach((resource) => this.members.delete(resource));
	}

	count() {
		return this.members.size;
	}
}
