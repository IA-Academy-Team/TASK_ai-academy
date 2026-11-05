import { auth } from "../../src/lib/auth.ts";

export async function signUpAndGetCookie(
  email: string,
  password = "supersecret123",
) {
  const { headers } = await auth.api.signUpEmail({
    body: { email, password, name: "Test" },
    returnHeaders: true,
  });
  return headers.getSetCookie();
}
