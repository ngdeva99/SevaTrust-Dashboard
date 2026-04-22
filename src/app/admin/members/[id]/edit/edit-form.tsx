"use client";

import { useRouter } from "next/navigation";
import { MemberForm, type MemberFormDefaults } from "@/components/admin/member-form";
import { updateMember } from "../../actions";

export default function EditForm({
  memberId,
  defaults,
}: {
  memberId: string;
  defaults: MemberFormDefaults;
}) {
  const router = useRouter();
  return (
    <MemberForm
      defaults={defaults}
      submitLabel="Save changes"
      onSubmit={async (fd) => {
        const r = await updateMember(memberId, fd);
        if (r?.ok) router.push(`/admin/members/${memberId}`);
        return r;
      }}
    />
  );
}
