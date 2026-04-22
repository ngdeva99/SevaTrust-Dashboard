"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { submitAddressChange } from "./actions";

interface Props {
  token: string;
  defaults: {
    phone: string;
    email: string;
    address_line1: string;
    address_line2: string;
    address_line3: string;
    city: string;
    state: string;
    pin_code: string;
    country: string;
  };
}

export default function AddressChangeForm({ token, defaults }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div className="py-6 text-center space-y-2">
        <div className="text-green-600 text-4xl">&#10003;</div>
        <h3 className="text-lg font-semibold">Request Submitted</h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          The trust admin will review your request and update your details.
        </p>
      </div>
    );
  }

  const handleSubmit = (formData: FormData) => {
    setError(null);
    formData.set("access_token", token);
    startTransition(async () => {
      const result = await submitAddressChange(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="new_phone" label="Phone" defaultValue={defaults.phone} />
        <Field name="new_email" label="Email" defaultValue={defaults.email} type="email" />
      </div>
      <Field name="new_address_line1" label="Address line 1" defaultValue={defaults.address_line1} />
      <Field name="new_address_line2" label="Address line 2" defaultValue={defaults.address_line2} />
      <Field name="new_address_line3" label="Address line 3" defaultValue={defaults.address_line3} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field name="new_city" label="City" defaultValue={defaults.city} />
        <Field name="new_state" label="State" defaultValue={defaults.state} />
        <Field name="new_pin_code" label="PIN Code" defaultValue={defaults.pin_code} />
      </div>
      <Field name="new_country" label="Country" defaultValue={defaults.country} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Submitting..." : "Submit Change Request"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
      />
    </div>
  );
}
