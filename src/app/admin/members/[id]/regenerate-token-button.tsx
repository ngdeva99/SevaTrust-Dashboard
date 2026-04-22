"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { regenerateAccessToken } from "../actions";

export default function RegenerateTokenButton({ memberId }: { memberId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function onClick() {
    if (
      !confirm(
        "Regenerate this member's access link? The old link will stop working immediately."
      )
    )
      return;
    start(async () => {
      const r = await regenerateAccessToken(memberId);
      if (r?.ok) setDone(true);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} type="button" disabled={pending}>
      <KeyRound className="h-4 w-4" />
      {pending ? "Regenerating…" : done ? "Regenerated" : "Regenerate"}
    </Button>
  );
}
