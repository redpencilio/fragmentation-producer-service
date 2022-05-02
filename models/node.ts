import { NamedNode, Term, DataFactory } from "n3";
const { namedNode } = DataFactory;
import Relation from "./relation";
import Resource from "./resource";
import * as RDF from "rdf-js";

export default class Node {
	id: number;
	members: Array<Resource> = [];
	relationsMap: Map<string, Relation> = new Map();
	view: RDF.NamedNode;
	stream: RDF.NamedNode;

	constructor(id: number, stream: RDF.NamedNode, view: RDF.NamedNode) {
		this.id = id;
		this.stream = stream;
		this.view = view;
	}

	get idNamedNode() {
		return namedNode(`./${this.id}`);
	}

	add_member(resource: Resource) {
		this.members.push(resource);
	}

	add_relation(relationValue: string, relation: Relation) {
		this.relationsMap.set(relationValue, relation);
	}

	add_members(resources: Resource[]) {
		resources.forEach((resource) => this.members.push(resource));
	}

	delete_members(resources: Resource[]) {
		resources.forEach((resource) => {
			let index = this.members.indexOf(resource);
			this.members.splice(index, 1);
		});
	}

	count() {
		return this.members.length;
	}
}
