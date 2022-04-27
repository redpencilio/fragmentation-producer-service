export default class PrefixCache {
	// maps prefixes to node files
	prefixes: Map<string, string> = new Map();

	addPrefix(prefix: string, nodeFile: string) {
		this.prefixes.set(prefix, nodeFile);
	}

	getNodeFile(prefix: string) {
		return this.prefixes.get(prefix);
	}

	getLongestMatch(value: string) {
		let longestPrefix: string | null = null;
		for (let i = 0; i < value.length; i++) {
			let prefix = value.substring(0, i + 1);
			if (this.prefixes.has(prefix)) {
				longestPrefix = prefix;
			}
		}
		if (longestPrefix) {
			return {
				prefix: longestPrefix,
				nodeFile: this.prefixes.get(longestPrefix)!,
			};
		}
		return null;
	}
}
