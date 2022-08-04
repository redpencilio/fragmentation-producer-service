import rdfParser from 'rdf-parse';
import Member from '../models/member';
import nodeStream from 'stream';
import { DataFactory } from 'n3';
const { namedNode } = DataFactory;

export default async function convertToMember(
  resource: string,
  body: any,
  contentType: string
): Promise<Member> {
  const quadStream = rdfParser.parse(nodeStream.Readable.from(body), {
    contentType,
  });
  const member = new Member(namedNode(resource));
  for await (const quadObj of quadStream) {
    member.addProperty(quadObj.predicate.value, quadObj.object);
  }
  return member;
}
