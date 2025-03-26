import { LoaderFunctionArgs } from "@remix-run/node";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI} from "@ai-sdk/google";
import { createDataStreamResponse, streamText, generateText } from "ai";
import { fetch } from "undici";
import { prisma } from "~/db.server";
import { getListFilesTool, getReadFileTool, projectUpdateTool, updateFile, answerTool, readFileContent, getPlanProjectUpdateTool } from "~/tools/project.tools";
import { DirectoryNode } from "@webcontainer/api";
import { InputJsonValue } from "@prisma/client/runtime/library";
import { Server } from "socket.io";
import { cloneDeep } from "lodash";
import { performance } from "perf_hooks";

type ModelProvider = "openai" | "deepseek" | "anthropic" | "google";

// Select which model provider to use
const MODEL_PROVIDER: ModelProvider = "anthropic" as ModelProvider;

// Initialize the appropriate model based on the provider
const model = (() => {
  switch (MODEL_PROVIDER) {
    case "deepseek":
      return createDeepSeek({ fetch: fetch as any });
    case "openai":
      return createOpenAI({ fetch: fetch as any });
    case "anthropic":
      return createAnthropic({ fetch: fetch as any });
    case "google":
      return createGoogleGenerativeAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        fetch: fetch as any 
      });
  }
})() 

interface ModelConfigOptions {
  maxTokens?: number;
  useStructuredOutputs?: boolean;
}

function getModelConfig({ maxTokens, useStructuredOutputs = true }: ModelConfigOptions = {}) {
  let modelName: string;
  const providerOptions: Record<string, any> = {};
  
  switch (MODEL_PROVIDER) {
    case "deepseek":
      modelName = "deepseek-chat";
      if (maxTokens !== undefined) {
        providerOptions.deepseek = { max_tokens: maxTokens };
      }
      break;
    case "openai":
      modelName = "gpt-4o";
      if (maxTokens !== undefined) {
        providerOptions.openai = { max_tokens: maxTokens };
      }
      break;
    case "anthropic":
      modelName = "claude-3-7-sonnet-20250219";
      if (maxTokens !== undefined) {
        providerOptions.anthropic = { max_tokens: maxTokens };
      }
      break;
    case "google":
      modelName = "gemini-2.0-pro-exp-02-05";
      if (maxTokens !== undefined) {
        providerOptions.google = { max_tokens: maxTokens };
      }
      break;
  }

  return {
    model: model(modelName) as any,
    ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: Record<string, any>;
}

interface FileSystemTree {
  [name: string]: DirectoryNode | { file: { contents: string } };
}

interface LoadContext {
  io: Server;
}

interface ProjectUpdateResponse {
  files: Array<{ path: string; content: string; explanation?: string }>;
}

interface UpdateFileResult {
  updatedContent?: string;
  [key: string]: any;
}

// Profiling utility
const profile = async (name: string, fn: () => Promise<any>) => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`⏱️ ${name} took ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`⏱️ ${name} failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
};

async function getCurrentProjectFiles(projectId: string): Promise<FileSystemTree> {
  return profile("getCurrentProjectFiles", async () => {
    console.log("🔍 Fetching project files for projectId:", projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            fileVersion: {
              select: {
                files: true,
              },
            },
          },
        },
      },
    });

    const currentFiles = (project?.messages[0]?.fileVersion?.files || {}) as FileSystemTree;
    console.log("📁 Retrieved files:", Object.keys(currentFiles).length, "files found");
    return currentFiles;
  });
}

async function generatePreliminaryResponse(messages: Message[], prompt: string, dataStream: any) {
  return profile("generatePreliminaryResponse", async () => {
    // console.log("🔍 Messages:", JSON.stringify(messages, null, 2));
    console.log("🔍 Prompt:", prompt);
    console.log("1️⃣ Starting preliminary response generation");
    
    try {
      const prelimResult = streamText({
        ...getModelConfig(),
        system: `You are an expert javascript/typescript engineer ai.
        Given a project prompt, provide a brief preliminary response of exactly 1-2 sentences.
        The response should be conversational and direct, without any markdown formatting or lists.
        Do not provide an overview of changes or implementation details.
        Do not ask questions or request user input.
        Simply acknowledge the request and indicate that you will proceed with making the changes.
        Example: "I'll help you create a responsive navigation menu with smooth animations."`,
        messages: [...messages.slice(-10), { role: "user", content: `Provide a preliminary response for this update: ${prompt}` }],
      });
      console.log("Preliminary response:", prelimResult);

      console.log("📤 Forwarding preliminary stream");
      prelimResult.mergeIntoDataStream(dataStream, {
        experimental_sendFinish: false,
      });

      const prelimResponse = await prelimResult.response;
      console.log("✅ Preliminary response completed:", prelimResponse.messages.length, "messages");
      
      // Log all messages in the response
      console.log("📝 Preliminary response messages:", JSON.stringify(prelimResponse.messages, null, 2));
      
      // Extract the text content from the last message's content array
      const lastMessage = prelimResponse.messages[prelimResponse.messages.length - 1];
      const textContent = Array.isArray(lastMessage.content) 
        ? lastMessage.content.find(item => item.type === 'text')?.text || ''
        : lastMessage.content;
      
      return textContent;
    } catch (error) {
      console.error("Error generating preliminary response:", (error as Error).message);
      throw error;
    }
  });
}

async function generateProjectUpdatePlan(
  messages: Message[],
  currentFiles: FileSystemTree,
  prompt: string
): Promise<any> {
  return profile("generateProjectUpdatePlan", async () => {
    console.log("2️⃣ Starting project update planning");
    
    try {
      // Get list of all files in the project
      const paths: string[] = [];
      function traverseFiles(obj: any, prefix = '') {
        if (obj.file?.contents) {
          paths.push(prefix);
        } else if (obj.directory) {
          Object.entries(obj.directory).forEach(([name, value]) => {
            traverseFiles(value, prefix ? `${prefix}/${name}` : name);
          });
        }
      }
      traverseFiles(currentFiles);
      
      const planResult = await generateText({
        model: createGoogleGenerativeAI({ 
          apiKey: process.env.GEMINI_API_KEY,
          fetch: fetch as any 
        })("gemini-2.0-flash"),
        tools: {
          readFiles: getReadFileTool(currentFiles),
          planProjectUpdate: getPlanProjectUpdateTool(currentFiles),
        },
        maxSteps: 3,
        toolChoice: "required",
        system: `You are an expert javascript/typescript engineer ai.
        Given the current project files and a prompt requesting changes, analyze the project and plan out the necessary updates.
        
        Here are all the files in the project:
        ${paths.join('\n')}
        
        When planning changes:
        - First examine App.tsx as it often contains the main application structure and routing
        - Only use the readFiles tool if changes outside of App.tsx are potentially needed
        - Use the planProjectUpdate tool to outline all the changes needed
        - It is okay to iterate on the plan multiple times to get it right
        - You must call the planProjectUpdate tool at least once
        
        Be thoughtful and precise with your planning. Maintain existing code style and patterns.`,
        messages: [...messages.slice(-10), {
          role: "user",
          content: `Project prompt: ${prompt}`
        }]
      });

      console.log("✅ Project update planning completed");
      
      // Extract planProjectUpdate tool results
      const planResults = planResult.toolResults
        .filter((result: { toolName: string }) => result.toolName === 'planProjectUpdate')
        .map((result: { result: any }) => result.result);

      return planResults[0] || { updates: [] };
    } catch (error) {
      console.error("Error in project update planning:", error);
      throw new Error(`Failed to generate project update plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

async function generateProjectUpdates(
  messages: Message[],
  currentFiles: FileSystemTree,
  prompt: string,
  dataStream: any,
  plan: any
): Promise<{ files: FileSystemTree; updateResults: any[] }> {
  return profile("generateProjectUpdates", async () => {
    console.log("3️⃣ Starting project update generation");
    console.log("📝 Input prompt:", prompt);
    console.log("📁 Current files count:", Object.keys(currentFiles).length);
    
    // Create a deep clone of currentFiles to avoid mutating the original
    const clonedFiles = cloneDeep(currentFiles);
    console.log("✅ Created deep clone of current files");
    
    console.log("📋 Using provided update plan:", JSON.stringify(plan, null, 2));
    console.log("📊 Number of planned updates:", plan.updates?.length || 0);
    
    // Execute the planned updates
    const updateResults = [];
    console.log("🛠️ Starting to execute planned updates...");

    console.log("🔄 Plan:", plan);
    const thePlan = { updates: [ plan.plan ] }
    
    for (const filePlan of thePlan.updates) {
      console.log(`📄 Processing update for file: ${filePlan.filePath}`);
      console.log("🔍 Update details:", JSON.stringify(filePlan.updates, null, 2));
      
      try {
        const result = await updateFile(
          clonedFiles,
          filePlan.filePath,
          filePlan.updates
        );
        console.log(`✅ Successfully updated ${filePlan.filePath}:`, JSON.stringify(result, null, 2));
        updateResults.push(result);
      } catch (error) {
        console.error(`❌ Failed to update ${filePlan.filePath}:`, error);
        throw error;
      }
    }

    console.log("📊 Final update results:", JSON.stringify(updateResults, null, 2));
    console.log("📁 Updated files count:", Object.keys(clonedFiles).length);
    console.log("✅ Project updates completed");
    
    return { files: clonedFiles, updateResults };
  });
}

async function generateExplanation(
  updateResults: any[],
  userPrompt: string,
  dataStream: any
): Promise<string> {
  console.log("3️⃣ Starting explanation generation", {
    updateResults: JSON.stringify(updateResults, null, 2),
    userPrompt,
  });
  
  try {
    const explanationResult = streamText({
      ...getModelConfig({ maxTokens: 32768 }),
      system: `You are an expert javascript/typescript engineer ai.
      Given the specific changes made and the original user request, provide a clear and concise summary of the updates.
      For small, focused changes, provide a brief 2-3 sentence explanation without any lists.
      For larger changes with multiple components or significant updates, use this structure:
      1. Start with a brief introductory sentence explaining the overall changes
      2. Use bullet points to list the key changes made, referencing specific files and changes
      3. End with 1-3 concluding sentences about the impact or next steps
      Keep the explanation technical but accessible.
      Use markdown for formatting but avoid headers - stick to bullet points and paragraphs.
      Keep the total explanation concise and focused.`,
      messages: [
        {
          role: "user",
          content: `This is the user prompt: "${userPrompt}"

Here are the specific updates made:
${JSON.stringify(updateResults, null, 2)}`
        }
      ],
    });

    console.log("📤 Forwarding explanation stream");
    explanationResult.mergeIntoDataStream(dataStream);

    const response = await explanationResult.response;
    console.log("✅ Explanation completed");
    
    // Extract the explanation from the last assistant message
    const lastMessage = response.messages[response.messages.length - 1];
    const content = lastMessage.content;
    
    // Handle both string and array of content objects
    if (Array.isArray(content)) {
      // Find the text content from the array of content objects
      const textContent = content.find(item => item.type === 'text')?.text;
      return textContent || '';
    }
    
    // Fallback for string content
    return typeof content === 'string' ? content : '';
  } catch (error) {
    console.error("Error generating explanation:", error);
    return "I've made the requested changes to the project. The updates have been applied successfully.";
  }
}

async function createProjectMessages(
  projectId: string,
  prompt: string,
  updatedFiles: FileSystemTree,
  explanation: string
) {
  return profile("createProjectMessages", async () => {
    // Create a new message with the updated files
    const userMessage = await prisma.message.create({
      data: {
        contents: prompt,
        type: "USER",
        project: {
          connect: {
            id: projectId
          }
        },
        fileVersion: {
          create: {
            files: updatedFiles as unknown as InputJsonValue,
          },
        },
      },
    });

    // Create an assistant message with the explanation
    const assistantMessage = await prisma.message.create({
      data: {
        contents: explanation,
        type: "SYSTEM", // Changed from "AI" to "SYSTEM" to match the MessageType union type
        project: {
          connect: {
            id: projectId
          }
        },
        fileVersion: {
          create: {
            files: updatedFiles as unknown as InputJsonValue,
          },
        },
      },
    });

    return { userMessage, assistantMessage };
  });
}

async function getUpdatedProject(projectId: string) {
  return profile("getUpdatedProject", async () => {
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

async function emitProjectUpdate(context: LoadContext, updatedProject: any) {
  return profile("emitProjectUpdate", async () => {
    if (context?.io && updatedProject) {
      const userId = updatedProject.userId;
      context.io.to(userId).emit('project:update', {
        projectId: updatedProject.id,
        project: updatedProject,
      });
    }
  });
}

export async function action({ request, context }: LoaderFunctionArgs & { context: LoadContext }) {
  return profile("action", async () => {
    console.log("🚀 Chat API request received");
    const { messages: rawMessages, projectId } = await request.json();
    console.log("📨 Request data:", { projectId, messageCount: rawMessages.length });
    
    // Clean messages by removing toolInvocations and parts from assistant messages
    const messages = rawMessages.map((msg: any) => {
      if (msg.role === 'assistant') {
        const { toolInvocations, parts, ...cleanedMsg } = msg;
        return cleanedMsg;
      }
      return msg;
    });
    
    // Extract prompt from the last user message
    const lastMessage = messages[messages.length - 1] as Message;
    const prompt = lastMessage.role === "user" ? lastMessage.content : "";
    console.log("📝 Extracted prompt:", prompt);
    
    if (!projectId) {
      throw new Error("No projectId found in request");
    }

    const currentFiles = await getCurrentProjectFiles(projectId);

    return createDataStreamResponse({
      execute: async dataStream => {
        console.log("🌊 Starting stream execution");
        
        // Start both preliminary response and project updates concurrently
        const [prelimResponse, plan] = await Promise.all([
          generatePreliminaryResponse(messages, prompt, dataStream),
          generateProjectUpdatePlan(messages, currentFiles, prompt)
        ]);
        
        await dataStream.write(`0:${JSON.stringify("\n\n")}\n`);
        
        if (plan) {
          // Generate project updates using the plan
          const { files: updatedFiles, updateResults } = await generateProjectUpdates(
            messages,
            currentFiles,
            prompt,
            dataStream,
            plan
          );
          
          // Generate and stream explanation of changes
          const explanation = await generateExplanation(updateResults, prompt, dataStream);
          await dataStream.write(`0:${JSON.stringify("\n\n")}\n`);

          // Combine preliminary response with explanation
          const combinedResponse = `${prelimResponse}\n\n${explanation}`;

          // Create messages and get updated project
          await createProjectMessages(projectId, prompt, updatedFiles, combinedResponse);
          const updatedProject = await getUpdatedProject(projectId);

          // Emit update to connected clients
          await emitProjectUpdate(context, updatedProject);
        }

        console.log("✨ Stream execution completed");
      },
    });
  });
}
