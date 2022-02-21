import fs from 'fs';
import { parse, graph, Store, NamedNode, serialize } from 'rdflib';

/**
 * Contains abstractions for working with files containing turtle
 * content.
 */

/**
 * Loads a file as a string.
 *
 * @param {string} file The file path as a string.
 * @return {string} Contents of the file, read as UTF-8.
 */
export function triplesFileAsString(file) {
  return fs.readFileSync(file, 'utf8');
}

/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @param {NamedNode} graph The graph to which we will write.
 * @param {Store?} store OPTIONAL: The store to which the content will be written.
 * @return {Store} Instance containing all triples which were downloaded.
 */
export function readTriples(file, targetGraph, store = graph()) {
  // TODO: targetGraph is not considered to be a new graph, how?
  parse(triplesFileAsString(file), store, targetGraph.value, "text/turtle");
  return store;
}

/**
 * Writes the triples in text-turtle to a file.
 *
 * @param {Store} store The store from which content will be written.
 * @param {NamedNode} graph The graph which will be written to the file.
 * @param {string} file Path of the file to which we will write the content.
 */
export function writeTriples(store, graph, file) {
  fs.writeFileSync(file, serialize(graph, store, 'text/turtle'));
}

/**
 * Returns the last page number currently available.
 *
 * @param {string} folder The folder in which the files are stored.
 *
 * @return {number | NaN} Biggest page index currently available or NaN
 * if no numbered pages were found.
 */
export function lastPage(folder) {
  const files = fs.readdirSync(folder);
  const fileNumbers = files
    .map((path) => {
      const match = path.match(/\d*/);
      const parsedNumber = match.length && parseInt(match[0]);
      if (parsedNumber && parsedNumber !== NaN)
        return parsedNumber;
      else
        return NaN;
    })
    .filter((x) => x !== NaN);

  fileNumbers.sort((a, b) => b - a);
  if (fileNumbers.length) {
    return fileNumbers[0];
  } else {
    return NaN;
  }
}

