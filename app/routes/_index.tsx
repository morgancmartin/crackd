import React, { useEffect, useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import { ActionFunction, redirect } from "@remix-run/node";
import { Link, Form, useActionData } from "@remix-run/react";
import {
  createProjectWithMessage,
  getInitialProject,
  createProjectMessage,
} from "../models/project.server";
import { defaultFiles } from "~/models/fileversion.server";
import { prisma } from "~/db.server";
import type { Message, Prisma } from "@prisma/client";

import { useOptionalUser } from "~/utils";
import { InputJsonObject } from "@prisma/client/runtime/library";

export const meta: MetaFunction = () => [{ title: "Remix Notes" }];

export const action: ActionFunction = async ({ request, context }) => {
  const formData = await request.formData();
  const text = formData.get("text");
  const userId = formData.get("userId");
  const io = context.io;

  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Project text is required.");
  }
  // Assuming you have some user authentication/session handling in place
  if (typeof userId !== "string") {
    return redirect("/login");
  }

  try {
    const project = await createProjectWithMessage({
      userId,
      messageContents: text,
      files: defaultFiles as unknown as InputJsonObject,
    });

    // Start AI generation and message creation in background
    getInitialProject({ prompt: text }).then((result) => {
      if (result.overview) {
        createProjectMessage({
          projectId: project.id,
          contents: result.overview,
          type: "SYSTEM",
          files: result.files as unknown as InputJsonObject,
        }).then((updatedProject) => {
          console.log("EMITTING PROJECT UPDATE", userId);
          (io as any).to(userId).emit("project_update", { project: updatedProject });
        });
      }
    });

    return redirect(`/~/${project.id}`);
  } catch (error) {
    console.error("Failed to create project:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export default function Index() {
  const user = useOptionalUser();
  const [text, setText] = useState("");
  const actionData = useActionData();

  useEffect(() => {
    if (user) {
      console.log("User:", user);
    }
  }, [user]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && user) {
      event.preventDefault(); // Prevents a new line from being added
      event.currentTarget.form?.submit(); // Submits the form
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  if (!user) {
    return (
      <div className="flex h-[100vh] w-[100vw] items-center justify-center bg-[#0A0A0A]">
        <h2 className="text-white">Please log in to create a project.</h2>
        <Form action="/auth/google" method="post">
          <button className="text-white">Login with Google</button>
        </Form>
      </div>
    );
  }

  return (
    <div className="flex h-[100vh] w-[100vw] items-center justify-center bg-[#0A0A0A]">
      <Form className="h-32 w-[25%]" method="post">
        <textarea
          name="text"
          placeholder="What would you like to build?"
          className="h-full w-full resize-none bg-[#141414] p-4 text-white"
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          value={text}
        />
        <input type="hidden" name="userId" value={user.id} />
      </Form>
    </div>
  );
}
