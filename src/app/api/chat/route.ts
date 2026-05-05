import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    state: "thinking",
    answer: "Chat pipeline stub",
  });
}
