import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for account provisioning.");
}

const accounts = [
  {
    username: "Varun",
    email: process.env.VARUN_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.VARUN_INITIAL_PASSWORD,
  },
  {
    username: "Akrati",
    email: process.env.AKRATI_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.AKRATI_INITIAL_PASSWORD,
  },
];

for (const account of accounts) {
  if (!account.email) {
    throw new Error(`${account.username.toUpperCase()}_ADMIN_EMAIL must be set before provisioning.`);
  }
}

if (accounts[0].email === accounts[1].email) {
  throw new Error("Varun and Akrati must use different email addresses.");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw new Error(`Could not list existing Supabase accounts: ${listError.message}`);

for (const account of accounts) {
  let authUser = users.users.find((user) => user.email === account.email);
  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      app_metadata: { ...authUser.app_metadata, role: "admin" },
      user_metadata: { ...authUser.user_metadata, username: account.username },
    });
    if (error) throw new Error(`Could not update the ${account.username} account role: ${error.message}`);
    authUser = data.user;
  } else {
    if (!account.password || account.password.length < 12 || account.password.length > 256) {
      throw new Error(`${account.username.toUpperCase()}_INITIAL_PASSWORD must be set to 12-256 characters before provisioning.`);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { username: account.username },
    });
    if (error) throw new Error(`Could not provision ${account.username}: ${error.message}`);
    authUser = data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: authUser.id,
      username: account.username,
      role: "admin",
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(`Could not save the ${account.username} admin profile: ${profileError.message}`);
  console.log(`Provisioned ${account.username} as admin.`);
}

console.log("Both administrator accounts are ready. Initial passwords were not printed.");
