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
		let childMatch = node.relationsMap.get(
			prefixValue + resourceValue[depth]
		);
		let curDepth = depth;
		let curPrefixValue = prefixValue;
		let curNode = node;
		while (childMatch && curDepth <= resourceValue.length) {
			// Check if we have to add the resource to a child of the current node, to the current node itself or if we have to split the current node.
			curNode = await this.cache.getNode(
				this.fileForNode(childMatch.targetId)
			);
			curDepth += 1;
			curPrefixValue = childMatch.value.value;
			childMatch = curNode.relationsMap.get(
				curPrefixValue + resourceValue[curDepth]
			);
		}

		// Add the resource to the current node, if it is full: split.
		if (this.shouldCreateNewPage(node)) {
			curNode.add_member(resource);
			// the current node has to be splitted
			await this.splitNode(curNode, prefixValue, resourceValue, depth);
		} else {
			// we can simply add the new resource to the current node as a member
			curNode.add_member(resource);
		}

		return curNode;
	}

	async splitNode(
		node: Node,
		currentValue: string,
		resourceValue: string,
		depth: number
	) {
		if (depth >= resourceValue.length) {
			return;
		}
		// Determine the token at the given depth which occurs the most and split off members matching that specific token
		let memberGroups: { [key: string]: Set<Resource> } = {};
		let pathValue;
		node.members.forEach((member) => {
			pathValue = member.dataMap.get(this.path.value);
			// let pathValue = getFirstMatch(member.data, null, this.path)?.object;
			if (pathValue) {
				let character = pathValue.value.charAt(depth);
				if (memberGroups[character]) {
					memberGroups[character].add(member);
				} else {
					memberGroups[character] = new Set([member]);
				}
			}
		});
		let mostOccuringToken = Object.keys(memberGroups).reduce((k1, k2) =>
			memberGroups[k1].size > memberGroups[k2].size ? k1 : k2
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

		node.delete_members(memberGroups[mostOccuringToken]);
		newNode.add_members(memberGroups[mostOccuringToken]);

		await this.cache.addNode(this.fileForNode(newNode.id), newNode);
		this.prefixCache.addPrefix(
			currentValue + mostOccuringToken,
			this.fileForNode(newNode.id)
		);
	}
}
