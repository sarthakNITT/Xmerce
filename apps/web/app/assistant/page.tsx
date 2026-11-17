import type { Metadata } from "next";
import { Assistant } from "./assistant";

export const metadata: Metadata = {
  title: "NovaTech shopping assistant",
  description:
    "Describe what you need and get NovaTech products that fit, with reasons and live availability.",
};

export default function AssistantPage() {
  return <Assistant />;
}
