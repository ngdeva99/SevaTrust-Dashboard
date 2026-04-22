/**
 * Create the first admin user.
 *
 * Run once after setting up your Supabase project:
 *
 *   pnpm seed
 *
 * It'll prompt for email, name, and password, create an auth user,
 * and add the corresponding row in the admins table.
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env.local`);
  return v;
}

async function main() {
  const rl = createInterface({ input, output });
  const email = (await rl.question("Admin email: ")).trim();
  const name = (await rl.question("Admin full name: ")).trim();
  const password = (await rl.question("Password (min 8 chars): ")).trim();
  const roleRaw = (await rl.question("Role [super_admin/editor] (default super_admin): ")).trim();
  rl.close();

  if (!email || !name || password.length < 8) {
    console.error("Email, name required; password must be >= 8 chars");
    process.exit(1);
  }
  const role = roleRaw === "editor" ? "editor" : "super_admin";

  const svc = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Creating auth user…");
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    console.error("Auth user creation failed:", error?.message);
    process.exit(1);
  }

  console.log("Inserting admins row…");
  const { error: e2 } = await svc.from("admins").insert({
    id: created.user.id,
    email,
    name,
    role,
    is_active: true,
  });
  if (e2) {
    console.error("admins insert failed:", e2.message);
    // cleanup the auth user so script is re-runnable
    await svc.auth.admin.deleteUser(created.user.id);
    process.exit(1);
  }

  console.log(`\n✓ Admin created: ${email} (role=${role})`);
  console.log("You can now sign in at /login");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
