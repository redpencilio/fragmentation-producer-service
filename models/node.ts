import { Term } from "n3";
import Relation from "./relation";
import Resource from "./resource";

export default class Node {
	id: Term;
	members: Resource[] = [];
	relations: Relation[] = [];
	view: Term;
	stream: Term;

	constructor(id: Term, stream: Term, view: Term) {
		this.id = id;
		this.stream = stream;
		this.view = view;
	}

	add_member(resource: Resource) {
		this.members.push(resource);
	}

	add_relation(relation: Relation) {
		this.relations.push(relation);
	}

	count() {
		return this.members.length;
	}
}
