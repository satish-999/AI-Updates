/** Opt-in real embedding smoke test. Downloads the original public model, no API key. */
import assert from "node:assert/strict";
import { pipeline, env } from "@xenova/transformers";
import sharp from "sharp";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { onnx } = require("onnx-proto");
env.cacheDir = new URL("../.models/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1");
const tiny = onnx.ModelProto.create({ irVersion: 8, producerName: "compatibility-fixture", graph: { name: "empty-fixture", node: [], input: [], output: [] } });
assert.equal(onnx.ModelProto.decode(onnx.ModelProto.encode(tiny).finish()).producerName, "compatibility-fixture");
const png = await sharp({create:{width:2,height:2,channels:3,background:"#008855"}}).png().toBuffer();
assert.equal((await sharp(png).metadata()).width,2);
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {quantized:true});
const output = await extractor(["A company launches a new artificial intelligence model.","A company launches a new artificial intelligence model.","Bananas and oranges are fruit."],{pooling:"mean",normalize:true});
assert.deepEqual(output.dims,[3,384]);
const vectors=[0,1,2].map(i=>Array.from(output.data.slice(i*384,(i+1)*384)));
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
for(const v of vectors){assert.ok(v.every(Number.isFinite));assert.ok(Math.abs(dot(v,v)-1)<0.0001);}
assert.ok(dot(vectors[0],vectors[1])>0.99999);
assert.ok(dot(vectors[0],vectors[2])<0.75);
console.log("PASS: protobuf ONNX round-trip, native sharp encode/decode, original quantized MiniLM model, 384 dimensions, normalization, duplicate similarity and unrelated-text separation.");
await extractor.dispose();
