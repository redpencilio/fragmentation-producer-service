import { Term } from "n3";
import Relation from "./relation";
import Resource from "./resource";

export default class Node {
	id: Term;
	members: Resource[] = [];
	relations: Relation[] = [];
	view: Term;

	constructor(id: Term, view: Term) {
		this.id = id;
		this.view = view;
	}

	add_member(resource: Resource) {
		this.members.push(resource);
	}

	add_relation(relation: Relation) {
		this.relations.push(relation);
	}
}
