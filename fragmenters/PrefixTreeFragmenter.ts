import { DataFactory } from "n3";
const { literal } = DataFactory;
import Node from "../models/node";
import Relation from "../models/relation";
import Resource from "../models/resource";
import { ldes, rdf, tree } from "../utils/namespaces";
import { generateTreeRelation, getFirstMatch } from "../utils/utils";
import * as RDF from "rdf-js";

import Fragmenter from "./Fragmenter";
import PrefixCache from "../storage/prefixCache";

export default class PrefixTreeFragmenter extends Fragmenter {
	prefixCache: PrefixCache = new PrefixCache();
	async addResource(resource: Resource): Promise<Node | null> {
		const viewFile = this.getViewFile();
		let viewNode: Node;
		// Check if the view node exists, if not, create one

		try {
			viewNode = await this.cache.getNode(viewFile);
		} catch (e) {
			console.log("No viewnode");
			viewNode = this.constructNewNode();
			await this.cache.addNode(this.getViewFile(), viewNode);
			this.prefixCache.addPrefix("", this.getViewFile());
		}
		let node = viewNode;
		let currentValue = "";
		// Find longest prefix which is stored in prefixCache
		let resourceValue = resource.dataMap.get(this.path.value)?.value;
		// let resourceValue = getFirstMatch(resource.data, null, this.path)
		// 	?.object.value;
		if (resourceValue) {
			const match = this.prefixCache.getLongestMatch(resourceValue);
			if (match) {
				node = await this.cache.getNode(match.nodeFile);
				currentValue = match.prefix;
			}
			const result = await this._addResource(
				resource,
				node,
				currentValue,
				resourceValue,
				currentValue.length
			);

			return result;
		}
		return null;
	}

	async _addResource(
		resource: Resource,
		node: Node,
		prefixValue: string = "",
		resourceValue: string,
		depth: number = 0
	): Promise<Node> {
		// Check if we have to add the resource to a child of the current node, to the current node itself or if we have to split the current node.
		const childMatch = node.relationsMap.get(
			prefixValue + resourceValue[depth]
		);
		if (childMatch) {
			const childNode = await this.cache.getNode(
				this.fileForNode(childMatch.targetId)
			);
			return await this._addResource(
				resource,
				childNode,
				childMatch.value.value,
				resourceValue,
				depth + 1
			);
		}
		// Add the resource to the current node, if it is full: split.
		if (this.shouldCreateNewPage(node)) {
			node.add_member(resource);
			// the current node has to be splitted
			await this.splitNode(node, prefixValue, depth);
		} else {
			// we can simply add the new resource to the current node as a member
			node.add_member(resource);
		}

		return node;
	}

	async splitNode(node: Node, currentValue: string, depth: number) {
		// Determine the token at the given depth which occurs the most and split off members matching that specific token
		let memberGroups: { [key: string]: number } = {};
		let memberList = [...node.members];
		for (let i = 0; i < memberList.length; i++) {
			const member = memberList[i];
			let pathValue = member.dataMap.get(this.path.value);
			// let pathValue = getFirstMatch(member.data, null, this.path)?.object;
			if (pathValue) {
				let character = pathValue.value.substring(depth, depth + 1);
				if (memberGroups[character]) {
					memberGroups[character] += 1;
				} else {
					memberGroups[character] = 1;
				}
			}
		}
		let mostOccuringToken = Object.keys(memberGroups).reduce((k1, k2) =>
			memberGroups[k1] > memberGroups[k2] ? k1 : k2
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
			currentValue + mostOccuringToken,
			new Relation(
				generateTreeRelation(),
				newRelationType,
				literal(currentValue + mostOccuringToken),
				this.getRelationReference(node.id, newNode.id),
				newNode.id,
				this.path
			)
		);

		for (let i = 0; i < memberList.length; i++) {
			const member = memberList[i];
			let pathValue = member.dataMap.get(this.path.value);
			if (pathValue) {
				let character = pathValue.value.substring(depth, depth + 1);
				if (character === mostOccuringToken) {
					node.members.delete(member);
					newNode.members.add(member);
				}
			}
		}

		await this.cache.addNode(this.fileForNode(newNode.id), newNode);
		this.prefixCache.addPrefix(
			currentValue + mostOccuringToken,
			this.fileForNode(newNode.id)
		);
	}
}
