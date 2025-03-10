import { redirect } from "react-router";
import { authenticator } from "../auth.server";
import { createUserSession } from "../session.server";
import type { User } from "../models/user.server";
import { LoaderFunctionArgs } from "@remix-run/node";

export let loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.authenticate("google", request);
  console.log("USER", user);
  return createUserSession({
    request,
    userId: (user as User).id,
    remember: false,
    redirectTo: "/",
  });
};
