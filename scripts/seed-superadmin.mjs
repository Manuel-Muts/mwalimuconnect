import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local before running this script.",
  );
}

function ask(question) {
  const prompt = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => {
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer.trim());
    });
  });
}

function askPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this script in an interactive terminal to enter the password securely.");
  }

  stdin.setEncoding("utf8");
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write("Password (input hidden): ");

  return new Promise((resolve, reject) => {
    let password = "";

    function finish(error) {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    }

    function onData(key) {
      if (key === "\r" || key === "\n") {
        finish();
      } else if (key === "\u0003") {
        finish(new Error("Password entry cancelled."));
      } else if (key === "\u007f" || key === "\b") {
        password = Array.from(password).slice(0, -1).join("");
      } else {
        password += key;
      }
    }

    stdin.on("data", onData);
  });
}

async function findUserByEmail(client, email) {
  const usersPerPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: usersPerPage,
    });
    if (error) throw new Error(`Could not look up Supabase users: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < usersPerPage) return null;
  }
}

async function main() {
  const name = await ask("Superadmin full name: ");
  const email = (await ask("Superadmin email: ")).toLowerCase();

  if (!name) throw new Error("Full name cannot be empty.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const client = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user = await findUserByEmail(client, email);
  const userAlreadyExisted = Boolean(user);

  if (!user) {
    const password = await askPassword();
    if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");

    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw new Error(`Could not create the Supabase user: ${error.message}`);
    user = data.user;
  }

  if (!user) throw new Error("Supabase did not return the created user.");

  const { error: profileError } = await client.from("profiles").upsert(
    { id: user.id, full_name: name, role: "admin" },
    { onConflict: "id" },
  );

  if (profileError) {
    if (!userAlreadyExisted) {
      const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
      const cleanupDetail = cleanupError
        ? ` The new auth user could not be removed: ${cleanupError.message}`
        : " The newly created auth user was removed.";
      throw new Error(`Could not assign the admin profile: ${profileError.message}.${cleanupDetail}`);
    }
    throw new Error(`Could not assign the admin profile: ${profileError.message}`);
  }

  console.log(
    `${userAlreadyExisted ? "Promoted existing user" : "Created superadmin"} ${email}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
