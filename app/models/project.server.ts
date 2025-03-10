import type { User, Project, Message, FileVersion } from "@prisma/client";
import { InputJsonObject } from "@prisma/client/runtime/library";
import { exec } from "child_process";
import { promisify } from "util";
import { defaultFiles } from "./fileversion.server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { DirectoryNode } from "@webcontainer/api";
import _ from "lodash";
import { z } from "zod";

import { prisma } from "~/db.server";

const execPromise = promisify(exec);

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

export async function getInitialProject({ prompt }: { prompt: string }) {
  const { toolCalls } = await generateText({
    model: anthropic("claude-3-7-sonnet-20250219"),
    tools: {
      answer: tool({
        description: "A tool for providing a response",
        parameters: z.object({
          file: z.string(),
          overview: z.string(),
        }),
      }),
    },
    toolChoice: "required",
    system: `
    You are an expert javascript/typescript engineer ai.

    You are given a project prompt and are expected to generate an initial App.tsx for a typescript vite
    project along with an overview of the file's features, design choices, etc in a conversational format as a response to the prompt.

    The overview should be in markdown format. It should not have a title header, it should just jump straight away into a conversational format.

    Include only the contents of the App.tsx file, no commentary, no delimiters.

    Do not import any libraries (beyond base React) or styles. Assume tailwind.

    Do not reference non-existent media files. Direct urls are encouraged.

    Be creative and imaginative. Gradient backgrounds, animations, emojis and other design elements are strongly recommended.
  `,
    prompt: `Return a project according to the prompt. prompt: ${prompt}`,
  });

  const files = _.cloneDeep(defaultFiles);

  const { file, overview } = toolCalls[0].args;

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
