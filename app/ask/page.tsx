import { Shell } from "../components/shell";
import { AskForm } from "./ask-form";
export const dynamic = "force-dynamic";
export default function Ask() { return <Shell><div className="feed-heading"><h1>Ask the archive</h1></div><AskForm /></Shell>; }
