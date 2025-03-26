import React, { useEffect, useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import { ActionFunction, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import {
  createProjectWithMessage,
  getInitialAppTsx,
  createProjectMessage,
  generatePreliminaryResponse,
} from "../models/project.server";
import { defaultFiles } from "~/models/fileversion.server";
import { useOptionalUser } from "~/utils";
import { InputJsonObject } from "@prisma/client/runtime/library";

async function getInitialProject({ 
  projectId, 
  prompt, 
  userId, 
  io 
}: { 
  projectId: string;
  prompt: string;
  userId: string;
  io: any;
}) {
  const prelimResponse = await generatePreliminaryResponse({ prompt });
  if (!prelimResponse) return;

  // First create the preliminary response message
  const projectWithPrelim = await createProjectMessage({
    projectId,
    contents: prelimResponse,
    type: "SYSTEM",
  });
  console.log("EMITTING PRELIMINARY RESPONSE", prelimResponse);
  io.to(userId).emit("project:update", { project: projectWithPrelim });

  // Then generate the file and overview using the preliminary response
  const result = await getInitialAppTsx({ 
    prompt,
    preliminaryResponse: prelimResponse 
  });
  
  if (result.overview) {
    const projectWithApp = await createProjectMessage({
      projectId,
      contents: result.overview,
      type: "SYSTEM",
      files: result.files as unknown as InputJsonObject,
    });
    console.log("EMITTING FILE AND OVERVIEW", userId);
    io.to(userId).emit("project:update", { project: projectWithApp });
  }
}

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
    getInitialProject({ projectId: project.id, prompt: text, userId, io });

    return redirect(`/~/${project.id}`);
  } catch (error) {
    console.error("Failed to create project:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export default function Index() {
  const user = useOptionalUser();
  const [text, setText] = useState("");

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
