import { NamedNode, Term } from "n3";

export default class Relation {
	id: Term;
	type: Term;
	value: Term;
	target: Term;
	path: Term;

	constructor(id: Term, type: Term, value: Term, target: Term, path: Term) {
		this.id = id;
		this.type = type;
		this.value = value;
		this.target = target;
		this.path = path;
	}
}
