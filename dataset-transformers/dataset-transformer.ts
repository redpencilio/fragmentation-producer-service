import jsstream from "stream";
import { DatasetConfiguration } from "../utils/utils";

export default interface DatasetTransformer {
	transform(
		input: jsstream.Readable,
		config: DatasetConfiguration
	): jsstream.Stream;
}
