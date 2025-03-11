import type { User, Project, Message, FileVersion, MessageType } from "@prisma/client";
import { InputJsonObject } from "@prisma/client/runtime/library";
import { defaultFiles } from "./fileversion.server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { DirectoryNode } from "@webcontainer/api";
import _ from "lodash";
import { getListFilesTool, getReadFileTool, projectAnswerTool, projectUpdateTool } from "~/tools/project.tools";

import { prisma } from "~/db.server";

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
      answer: projectAnswerTool,
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

  const { file, overview, preliminaryResponse } = toolCalls[0].args;
  const combinedOverview = preliminaryResponse ? `${preliminaryResponse}\n\n${overview}` : overview;

  if ((files.directory.src as DirectoryNode).directory) {
    (files.directory.src as DirectoryNode).directory["App.tsx"] = {
      file: { contents: file },
    };
  }

  return {
    files,
    overview: combinedOverview,
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

function updateFileStructure(currentFiles: InputJsonObject, updates: Array<{ path: string; content: string }>) {
  const updatedFiles = _.cloneDeep(currentFiles);
  
  for (const { path, content } of updates) {
    const parts = path.split('/');
    let current: any = updatedFiles;
    
    // Navigate to parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.directory) {
        current.directory = {};
      }
      if (!current.directory[part]) {
        current.directory[part] = { directory: {} };
      }
      current = current.directory[part];
    }
    
    // Update or create the file
    const fileName = parts[parts.length - 1];
    if (!current.directory) {
      current.directory = {};
    }
    current.directory[fileName] = {
      file: { contents: content }
    };
  }

  return updatedFiles;
}

export async function updateProjectFiles({
  prompt,
  project,
}: {
  prompt: string;
  project: Project;
}) {
  type AnswerResponse = {
    files: Array<{ path: string; content: string }>;
    explanation: string;
    preliminaryResponse?: string;
  };

  // Get the most recent message's fileVersion
  const latestMessage = await prisma.message.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: {
      fileVersion: {
        select: {
          files: true,
        },
      },
    },
  });

  const currentFiles = latestMessage?.fileVersion?.files as InputJsonObject || {};

  const { toolCalls } = await generateText({
    model: anthropic("claude-3-7-sonnet-20250219"),
    tools: {
      listFiles: getListFilesTool(currentFiles),
      readFile: getReadFileTool(currentFiles),
      answer: projectUpdateTool,
    },
    maxSteps: 10,
    toolChoice: "required",
    system: `
    You are an expert javascript/typescript engineer ai.
    
    You are given a project and a prompt requesting changes. Your task is to:
    1. Use listFiles and readFile to understand the current project structure
    2. Determine which files need to be modified based on the prompt
    3. Return the updated file contents and an explanation of changes
    
    Be thoughtful and precise with your changes. Maintain existing code style and patterns.
    Ensure all changes are compatible with the existing codebase.
    `,
    prompt: `Project ID: ${project.id}
    Change Request: ${prompt}
    
    Please analyze the project and make the requested changes.`,
  });

  const response = toolCalls[0].args as AnswerResponse;

  // Update the files with the changes
  const updatedFiles = updateFileStructure(currentFiles, response.files);

  // Create a new message with the updated files and return the complete project
  const updatedProject = await createProjectMessage({
    projectId: project.id,
    contents: prompt,
    type: "USER",
  });

  // Create a follow-up message with the explanation, including preliminaryResponse if it exists
  const combinedExplanation = response.preliminaryResponse 
    ? `${response.preliminaryResponse}\n\n${response.explanation}`
    : response.explanation;

  return await createProjectMessage({
    projectId: project.id,
    contents: combinedExplanation,
    type: "SYSTEM",
    files: updatedFiles,
  });
}
