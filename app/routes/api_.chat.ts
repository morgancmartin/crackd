// Remix
import { LoaderFunctionArgs } from "@remix-run/node";

// Third-party
import { createDataStreamResponse } from "ai";
import { Server } from "socket.io";
import _ from "lodash";

// Local
import {
  Message,
  profile,
  generatePreliminaryResponse,
  generateProjectUpdates,
  FileSystemTree,
  generateComplexityCheck,
} from "~/lib/chat";
import {
  createProjectUpdateMessages,
  getProject,
  getCurrentProjectFiles,
} from "~/models/project.server";
import { emitProjectUpdate } from "~/lib/socket";

interface LoadContext {
  io: Server;
  userId: string;
}

interface ChatRequest {
  messages: Message[];
  projectId: string;
}

function cleanMessages(rawMessages: any[]): Message[] {
  return rawMessages.map((msg: any) => {
    if (msg.role === "assistant") {
      const { toolInvocations, parts, ...cleanedMsg } = msg;
      return cleanedMsg;
    }
    return msg;
  });
}

async function processChatResponse(
  messages: Message[],
  prompt: string,
  currentFiles: FileSystemTree,
  dataStream: any,
  projectId: string,
  context: LoadContext
) {
  const complexity = await generateComplexityCheck(messages, prompt);
  if (complexity === 'complex') {
    console.log("🔄 Switching to complex model for project updates");
  }

  const prelimResponse = await generatePreliminaryResponse(
    messages,
    prompt,
    dataStream,
  );
  await dataStream.write(`0:${JSON.stringify("\n\n")}\n`);

  const { files: updatedFiles, commentary } =
    await generateProjectUpdates(messages, currentFiles, prompt, dataStream, complexity);

  const explanation = commentary.join("\n");
  await dataStream.write(`0:${JSON.stringify("\n\n")}\n`);

  const combinedResponse = `${prelimResponse}\n\n${explanation}`;

  const isInitialGeneration = messages.length === 1;
  await createProjectUpdateMessages(projectId, prompt, updatedFiles, combinedResponse, isInitialGeneration);

  const updatedProject = await getProject({
    id: projectId,
    userId: context.userId,
  });

  await emitProjectUpdate(context, updatedProject);
}

export async function action({
  request,
  context,
}: LoaderFunctionArgs & { context: LoadContext }) {
  return profile("action", async () => {
    const { messages: rawMessages, projectId } = await request.json() as ChatRequest;
    
    if (!projectId) {
      throw new Error("No projectId found in request");
    }

    const messages = cleanMessages(rawMessages);
    const lastMessage = messages[messages.length - 1] as Message;
    const prompt = lastMessage.role === "user" ? lastMessage.content : "";
    const currentFiles = await getCurrentProjectFiles(projectId);

    return createDataStreamResponse({
      execute: async (dataStream) => {
        await processChatResponse(messages, prompt, currentFiles, dataStream, projectId, context);
      },
    });
  });
}
