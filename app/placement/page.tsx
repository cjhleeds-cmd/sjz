"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HistoryApp } from "../page";

function PlacementContent() {
  const item = useSearchParams().get("item") ?? undefined;
  const initialPlacementItemKey = item?.startsWith("event:") || item?.startsWith("figure:") ? item : undefined;
  return <HistoryApp view="placement" initialPlacementItemKey={initialPlacementItemKey} />;
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>加载中…</div>}>
      <PlacementContent />
    </Suspense>
  );
}
