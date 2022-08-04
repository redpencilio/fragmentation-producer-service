export default class RelationCache {
  // maps prefixes to node files
  relationValueMap: Map<string, string> = new Map();

  addRelation(prefix: string, nodeFile: string) {
    this.relationValueMap.set(prefix, nodeFile);
  }

  getNodeFile(value: string) {
    return this.relationValueMap.get(value);
  }

  getLongestMatch(value: string) {
    let longestPrefix: string | null = null;
    for (let i = 0; i < value.length; i++) {
      const prefix = value.substring(0, i + 1);
      if (this.relationValueMap.has(prefix)) {
        longestPrefix = prefix;
      }
    }
    if (longestPrefix) {
      return {
        prefix: longestPrefix,
        nodeFile: this.relationValueMap.get(longestPrefix)!,
      };
    }
    return null;
  }
}
