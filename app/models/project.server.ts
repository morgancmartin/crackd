import type { User, Project, Message, FileVersion, MessageType } from "@prisma/client";
import { InputJsonObject } from "@prisma/client/runtime/library";
import { defaultFiles } from "./fileversion.server";
import { anthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject, generateText } from "ai";
import { DirectoryNode } from "@webcontainer/api";
import _ from "lodash";
import { getListFilesTool, getReadFileTool, projectAnswerSchema, projectUpdateTool } from "~/tools/project.tools";

import { prisma } from "~/db.server";

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export function getProject({
  id,
  userId,
}: Pick<Project, "id"> & {
  userId: User["id"];
}) {
  return prisma.project.findFirst({
    select: {
      id: true,
      title: true,
      user: {
        select: {
          picture: true,
        },
      },
      messages: {
        select: {
          id: true,
          contents: true,
          type: true,
          fileVersion: {
            select: {
              files: true,
            },
          },
        },
      },
    },
    where: { id, userId },
  });
}

export function getProjectListItems({ userId }: { userId: User["id"] }) {
  return prisma.project.findMany({
    where: { userId },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function generateTitle({ prompt }: { prompt: string }) {
  const result = await generateText({
    model: anthropic("claude-3-7-sonnet-20250219"),
    system: `You are an expert at creating short, memorable project titles.
    Given a project description, generate a concise and creative title that captures its essence.
    The title should be 2-4 words, memorable, and avoid generic terms.
    Return only the title text, nothing else.`,
    prompt: `Generate a title for this project: ${prompt}`,
  });

  return result.text;
}

export async function createProjectWithMessage({
  userId,
  messageContents,
  files,
}: {
  userId: User["id"];
  messageContents: Message["contents"];
  files: InputJsonObject;
}) {
  const title = await generateTitle({ prompt: messageContents });

  return prisma.project.create({
    data: {
      title,
      user: {
        connect: {
          id: userId,
        },
      },
      messages: {
        create: {
          contents: messageContents,
        },
      },
    },
    include: {
      messages: true,
    },
  });
}

export function deleteProject({
  id,
  userId,
}: Pick<Project, "id"> & { userId: User["id"] }) {
  return prisma.project.deleteMany({
    where: { id, userId },
  });
}

export function createProjectMessage({
  projectId,
  contents,
  type = "USER",
  files = defaultFiles as unknown as InputJsonObject,
}: {
  projectId: Project["id"];
  contents: Message["contents"];
  type?: Message["type"];
  files?: InputJsonObject;
}) {
  return prisma.message.create({
    data: {
      contents,
      type,
      project: {
        connect: {
          id: projectId
        }
      },
      fileVersion: {
        create: {
          files,
        },
      },
    },
  }).then(() => {
    // After creating the message, fetch and return the complete project
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            fileVersion: {
              select: {
                files: true,
              },
            },
          },
        },
      },
    });
  });
}

export async function generatePreliminaryResponse({ prompt }: { prompt: string }) {
  try {
    const result = await generateText({
      model: anthropic("claude-3-7-sonnet-20250219"),
      system: `You are an expert javascript/typescript engineer ai.
      Given a project prompt, provide a brief preliminary response (2-3 sentences) outlining your plan for the project.
      The response should be in markdown format and conversational.
      Keep it under 100 words.`,
      prompt: `Provide a preliminary response for this project: ${prompt}`,
    });
    return result.text;
  } catch (error) {
    console.error("Error generating preliminary response:", error);
    throw error;
  }
}

export async function getInitialAppTsx({ 
  prompt,
  preliminaryResponse 
}: { 
  prompt: string;
  preliminaryResponse: string;
}) {
  let object;
  
  try {
    const result = await generateObject({
      model: anthropic("claude-3-7-sonnet-20250219"),
      schema: projectAnswerSchema,
      providerOptions: {
        anthropic: {
          maxTokens: 3000,
        },
      },
      system: `
      You are an expert javascript/typescript engineer ai.

      You are given a project prompt and a preliminary response outlining the plan. You are expected to generate two responses:
       - an initial App.tsx for a typescript vite project that implements the plan,
       - and an overview of the generated App.tsx file's features, design choices, etc in a conversational format as a response to the prompt.

      The overview should be in markdown format. It should not have a title header, it should just jump straight away into a conversational format.

      For the initial App.tsx file:
      - Do not import any libraries (beyond base React) or styles. Assume tailwind.
      - Do not reference non-existent media files. Direct urls are encouraged.
      - Be creative and imaginative. Gradient backgrounds, animations, emojis and other design elements are strongly recommended.

      Ensure your response conforms to the zod schema:
      z.object({
        file: z.string(),
        overview: z.string(),
      })
      `,
      prompt: `Project prompt: ${prompt}
      Preliminary plan: ${preliminaryResponse}
      
      Return a schema-compliant initial project response according to the prompt and plan.`,
    });
    object = result.object;
  } catch (error) {
    console.error("Error generating initial project:", error);
    throw error;
  }

  const files = _.cloneDeep(defaultFiles);

  const { file, overview } = object;

  if ((files.directory.src as DirectoryNode).directory) {
    (files.directory.src as DirectoryNode).directory["App.tsx"] = {
      file: { contents: file },
    };
  }

  return {
    files,
    overview,
  };
}

export function updateProjectTitle({
  id,
  userId,
  title,
}: Pick<Project, "id" | "title"> & {
  userId: User["id"];
}) {
  return prisma.project.update({
    where: { 
      id,
      userId, // Ensure the user owns the project
    },
    data: {
      title,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          fileVersion: {
            select: {
              files: true,
            },
          },
        },
      },
    },
  });
}