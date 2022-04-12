import { NamedNode, Store, Term } from "n3";
import { rdf, tree } from "../utils/namespaces";
import { getFirstMatch } from "../utils/utils";
import Relation from "./relation";
import Resource from "./resource";

export default class Node {
	id: Term;
	members: Resource[];
	relations: Relation[];
	view: Term;

	data: Store;

	constructor(data: Store) {
		this.data = data;
	}

	get id(): Term | null {
		const match = this.data.getQuads(null, rdf("type"), tree("Node"), null);
		if (match.length > 0) {
			console.log(match);
			return match[0].subject;
		}
		throw Error("Id not found!");
	}

	getMembers(): Resource[] {
		const memberIds = this.data
			.getQuads(null, tree("member"), null, null)
			.map((quad) => quad.object);
		const members: Resource[] = [];
		memberIds.forEach((memberId) => {
			let content = new Store(
				this.data.getQuads(memberId, null, null, null)
			);
			members.push(new Resource(memberId, content));
		});
		return members;
	}

	getRelations(): Relation[] {
		const relationIds = this.data
			.getQuads(this.id, tree("relation"), null, null)
			.map((quad) => quad.object);
		const relations: Relation[] = [];

		relationIds.forEach((relationId) => {
			let type = getFirstMatch(
				this.data,
				relationId,
				rdf("type"),
				null,
				null
			)?.object;
			let value = getFirstMatch(
				this.data,
				relationId,
				tree("value"),
				null,
				null
			)?.object;
			let target = getFirstMatch(
				this.data,
				relationId,
				tree("node"),
				null,
				null
			)?.object;
			let path = getFirstMatch(
				this.data,
				relationId,
				tree("path"),
				null,
				null
			)?.object;
			if (type && value && target && path) {
				relations.push(
					new Relation(relationId, type, value, target, path)
				);
			}
		});

		return relations;
	}

	count() {
		return this.data.countQuads(null, tree("member"), null, null);
	}
}
