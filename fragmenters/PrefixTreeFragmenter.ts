import { Store, Quad, NamedNode, DataFactory, Term, Literal } from "n3";
const { literal } = DataFactory;
import Node from "../models/node";
import Relation from "../models/relation";
import Resource from "../models/resource";
import { ldes, rdf, tree } from "../utils/namespaces";
import { generateTreeRelation, getFirstMatch } from "../utils/utils";
import * as RDF from "rdf-js";

import Fragmenter from "./Fragmenter";

export default class PrefixTreeFragmenter extends Fragmenter {
	async addResource(resource: Resource): Promise<Node> {
		const viewFile = this.getViewFile();
		let viewNode: Node;
		// Check if the view node exists, if not, create one

		try {
			viewNode = await this.cache.getNode(viewFile);
		} catch (e) {
			console.log("No viewnode");
			viewNode = this.constructNewNode();
			this.cache.addNode(this.getViewFile(), viewNode);
			// await this.cache.setNode(this.getViewFile(), viewNode);
		}

		const result = await this._addResource(resource, viewNode);

		return result;
	}

	async _addResource(
		resource: Resource,
		node: Node,
		currentValue: string = "",
		depth: number = 0
	): Promise<Node> {
		// Check if we have to add the resource to a child of the current node, to the current node itself or if we have to split the current node.
		const children = node.relations;
		if (children.length > 0) {
			// The current node has children, check if any of the relations match with the to be added resource
			for (let childRelation of children) {
				// Retrieve the value of the relation path in the to be added resource
				const resourceTermValue = getFirstMatch(
					resource.data,
					resource.id,
					childRelation.path
				)?.object.value;
				if (resourceTermValue) {
					// Check which type of relation we are dealing with and check if the resource fulfills the specific relation
					if (
						(childRelation.type.equals(tree("PrefixRelation")) &&
							resourceTermValue.startsWith(
								childRelation.value.value
							)) ||
						(childRelation.type.equals(tree("EqualsRelation")) &&
							resourceTermValue == childRelation.value.value)
					) {
						const childNode = await this.cache.getNode(
							this.fileForNode(childRelation.targetId)
						);
						return await this._addResource(
							resource,
							childNode,
							childRelation.value.value,
							depth + 1
						);
					}
				}
			}
		}
		// Add the resource to the current node, if it is full: split.
		if (this.shouldCreateNewPage(node)) {
			node.add_member(resource);
			// the current node has to be splitted
			await this.splitNode(node, currentValue, depth);
		} else {
			// we can simply add the new resource to the current node as a member
			node.add_member(resource);
			// await this.cache.setNode(this.fileForNode(node.id.value), node);
		}

		return node;
	}

	async splitNode(node: Node, currentValue: string, depth: number) {
		// Determine the token at the given depth which occurs the most and split off members matching that specific token
		let memberGroups: { [key: string]: Resource[] } = {};
		node.members.forEach((member) => {
			let pathValue = getFirstMatch(member.data, null, this.path)?.object;
			if (pathValue) {
				let character = pathValue.value.substring(depth, depth + 1);
				if (memberGroups[character]) {
					memberGroups[character].push(member);
				} else {
					memberGroups[character] = [member];
				}
			}
		});
		let mostOccuringToken = Object.keys(memberGroups).reduce((k1, k2) =>
			memberGroups[k1].length > memberGroups[k2].length ? k1 : k2
		);
		let newRelationType: RDF.Term;
		if (mostOccuringToken === "") {
			newRelationType = tree("EqualsRelation");
			// if the mostOccuringToken is an empty string => a lot of members have the same value for path => add equalrelation
		} else {
			newRelationType = tree("PrefixRelation");
			// else create a new relation and node with prefix value containing mostOccuringToken
		}
		let newNode: Node = this.constructNewNode();
		node.add_relation(
			new Relation(
				generateTreeRelation(),
				newRelationType,
				literal(currentValue + mostOccuringToken),
				this.getRelationReference(node.id, newNode.id),
				newNode.id,
				this.path
			)
		);

		node.delete_members(memberGroups[mostOccuringToken]);

		newNode.add_members(memberGroups[mostOccuringToken]);

		this.cache.addNode(this.fileForNode(newNode.id), newNode);
		// await this.cache.setNode(this.fileForNode(node.id.value), node);
		// await this.cache.setNode(this.fileForNode(newNode.id.value), newNode);
	}
}
