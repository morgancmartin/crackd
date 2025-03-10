// app/routes/auth.google.tsx
import { authenticator } from "../auth.server";
import { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

export let loader = ({ request }: LoaderFunctionArgs) => {
  return authenticator.authenticate("google", request);
};

export let action = ({ request }: ActionFunctionArgs) => {
  return authenticator.authenticate("google", request);
};
