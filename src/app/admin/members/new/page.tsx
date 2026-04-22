"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MemberForm } from "@/components/admin/member-form";
import { createMember } from "../actions";

export default function NewMemberPage() {
  const router = useRouter();
  const [memberType, setMemberType] = useState<"life_member" | "annual">("life_member");

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New member</h1>

      <Card>
        <CardHeader>
          <CardTitle>Subscription type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label>Initial subscription</Label>
            <Select
              value={memberType}
              onChange={(e) => setMemberType(e.target.value as "life_member" | "annual")}
            >
              <option value="life_member">Life member (LM-####)</option>
              <option value="annual">Annual subscriber (AS-####)</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberForm
            submitLabel="Create member"
            onSubmit={async (fd) => {
              const res = await createMember(fd, { as: memberType });
              if (res?.ok && res.id) {
                router.push(`/admin/members/${res.id}`);
              }
              return res;
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
