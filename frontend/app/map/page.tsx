"use client";

import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function MapPage() {
  return <LiveMap />;
}
