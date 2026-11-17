import type { Metadata } from "next";
import { Chat } from "./chat";

export const metadata: Metadata = {
  title: "Ask NovaTech",
  description:
    "Answers on returns, refunds, delivery, warranty and membership, from NovaTech's approved documents.",
};

export default function AskPage() {
  return <Chat />;
}
