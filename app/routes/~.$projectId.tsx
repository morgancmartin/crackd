// External libraries
import type {
  LoaderFunctionArgs,
  HeadersFunction,
  ActionFunctionArgs,
} from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useSubmit,
  Link,
  useParams,
  useFetcher,
} from "@remix-run/react";
import type { User } from "@prisma/client";
import { useEffect, useRef, useCallback } from "react";
import invariant from "tiny-invariant";
import { PiExportBold, PiCloudArrowUpBold, PiRocketLaunchBold } from "react-icons/pi";
import { useChat } from "@ai-sdk/react";

// Internal modules
import { getProject, updateProjectTitle } from "~/models/project.server";
import { requireUserId } from "~/session.server";
import { useOptionalUser } from "~/utils";
import { useProject } from "~/hooks/useProject";

// Components
import MarkdownRenderer from "~/components/markdownRenderer";
import { AppDisplay } from "~/components/AppDisplay";
import { ProjectTitle } from "~/components/ProjectTitle";
import { Button } from "~/components/ui/button";

// Function to generate a random 16-character string
function generateRandomId() {
  return Math.random().toString(36).substring(2, 18);
}

// Custom hook for handling initial message
function useInitialMessage(project: any, projectId: string | undefined) {
  const hasProcessedInitialMessage = useRef(false);
  const fetcher = useFetcher();

  useEffect(() => {
    console.log("Effect running with:", {
      hasProcessed: hasProcessedInitialMessage.current,
      messageCount: project?.messages.length,
      firstMessageType: project?.messages[0]?.type,
      projectId: projectId,
    });

    if (
      !hasProcessedInitialMessage.current &&
      project?.messages.length === 1 &&
      project.messages[0].type === "USER"
    ) {
      console.log("Triggering initial message submission");
      hasProcessedInitialMessage.current = true;

      // Make direct API call to /api/chat with correct payload format
      const payload = {
        id: generateRandomId(),
        messages: [
          {
            role: "user",
            content: project.messages[0].contents,
            parts: [
              {
                type: "text",
                text: project.messages[0].contents,
              },
            ],
          },
        ],
        projectId: projectId || "",
      };

      fetcher.submit(payload, {
        method: "post",
        action: "/api/chat",
        encType: "application/json",
      });
    } else {
      const reason = hasProcessedInitialMessage.current
        ? "already processed"
        : project?.messages.length !== 1
          ? "not exactly one message"
          : project?.messages[0]?.type !== "USER"
            ? "not a USER message"
            : "unknown";

      console.log("Skipping form submission:", { reason });

      if (reason === "not exactly one message") {
        console.log(
          "Current messages:",
          project?.messages.map((m: { id: string; type: string; contents: string }) => ({
            id: m.id,
            type: m.type,
            contents: m.contents,
          })),
        );
      }
    }
  }, [project?.messages, fetcher, projectId]);
}

// Alternative hook that simulates user interaction with the textarea
function useAltInitialMessage(project: any, projectId: string | undefined, textareaRef: React.RefObject<HTMLTextAreaElement>, setInput: (value: string) => void) {
  const hasProcessedInitialMessage = useRef(false);

  useEffect(() => {
    // Add a small delay to ensure everything is initialized
    const timeoutId = setTimeout(() => {
      console.log("Effect running with:", {
        hasProcessed: hasProcessedInitialMessage.current,
        messageCount: project?.messages.length,
        firstMessageType: project?.messages[0]?.type,
        projectId: projectId,
        project: project,
      });

      if (
        !hasProcessedInitialMessage.current &&
        project?.messages.length === 1 &&
        project.messages[0].type === "USER"
      ) {
        console.log("Triggering initial message submission");
        hasProcessedInitialMessage.current = true;

        // Set the input value to the initial message
        setInput(project.messages[0].contents);

        // Use setTimeout to ensure the input value is set before simulating the enter key
        setTimeout(() => {
          if (textareaRef.current) {
            // Create and dispatch an Enter key event
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            console.log("Dispatching Enter key event");
            textareaRef.current.dispatchEvent(enterEvent);
          }
        }, 0);
      } else {
        const reason = hasProcessedInitialMessage.current
          ? "already processed"
          : project?.messages.length !== 1
            ? "not exactly one message"
            : project?.messages[0]?.type !== "USER"
              ? "not a USER message"
              : "unknown";

        console.log("Skipping form submission:", { reason });

        if (reason === "not exactly one message") {
          console.log(
            "Current messages:",
            project?.messages.map((m: { id: string; type: string; contents: string }) => ({
              id: m.id,
              type: m.type,
              contents: m.contents,
            })),
          );
        }
      }
    }, 100); // Add a 100ms delay to ensure everything is initialized

    return () => clearTimeout(timeoutId);
  }, [project?.messages, projectId, setInput, textareaRef]);
}

export const headers: HeadersFunction = () => ({
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const formData = await request.formData();
  const title = formData.get("title");

  if (title) {
    if (typeof title !== "string") {
      return { error: "Title must be a string" };
    }

    const project = await updateProjectTitle({
      id: params.projectId,
      userId,
      title,
    });

    return { project };
  }

  return { error: "No valid action specified" };
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const project = await getProject({ id: params.projectId, userId });
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  return {
    project,
  } as const;
};

export default function ProjectDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const user = useOptionalUser();
  const submit = useSubmit();
  const params = useParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { project, files, isConnected } = useProject(
    data.project,
    user as User,
  );
  const { messages, input, handleInputChange, handleSubmit, setInput } =
    useChat({
      api: "/api/chat",
      onFinish: (message) => {
        // Handle any post-message actions if needed
      },
      body: {
        projectId: params.projectId,
      },
    });

  // Original implementation using direct API call
  // useInitialMessage(project, params.projectId);
  
  // Alternative implementation using textarea simulation
  useAltInitialMessage(project, params.projectId, textareaRef, setInput);

  if (!project) {
    return (
      <div className="flex h-full min-h-screen w-full flex-col items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-white"></div>
          <p className="text-sm text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen w-full flex-col overflow-y-hidden bg-[#080808]">
      <div className="grid grid-cols-3 items-center border-b border-gray-800 px-12">
        <div className="col-start-1">
          <Link
            to="/"
            reloadDocument
            className="text-xl font-bold text-white transition-colors hover:text-gray-300"
          >
            Crackd
          </Link>
        </div>
        <div className="flex justify-center">
          <ProjectTitle title={project.title} />
        </div>
        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" size="sm">
            <PiExportBold />
            Export
          </Button>
          <Button variant="secondary" size="sm">
            <PiCloudArrowUpBold />
            Connect to Supabase
          </Button>
          <Button variant="secondary" size="sm">
            <PiRocketLaunchBold />
            Deploy
          </Button>
        </div>
      </div>
      <div
        className="scrollbar-thumb:bg-gray-400 relative flex h-full w-full flex-1 flex-col overflow-y-scroll pb-4 pb-48 scrollbar-thin scrollbar-track-[#171717] scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full scrollbar-hover:bg-gray-300"
        style={{ scrollbarWidth: "auto" }}
      >
        <Messages messages={messages} />
        <div className="fixed bottom-0 left-0 h-40 w-[30%] flex-col justify-center gap-0 px-12">
          <div className="h-[85%] w-full bg-transparent">
            <form onSubmit={handleSubmit} className="h-full w-full">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                name="contents"
                placeholder="How can Crackd help you today?"
                className="h-full w-full resize-none rounded-lg border border-gray-700 bg-[#171717cc] bg-opacity-90 p-4 text-sm text-white backdrop-blur-md focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    console.log("ENTER KEY PRESSED", e);
                    handleSubmit(e);
                  }
                }}
              ></textarea>
            </form>
          </div>
          <div className="h-[15%] w-full bg-black"></div>
        </div>
        <div className="fixed right-0 mr-4 flex h-[888px] w-[70%] items-end justify-end overflow-y-hidden pb-4">
          <AppDisplay files={files} />
        </div>
      </div>
    </div>
  );
}

function Messages({
  messages,
}: {
  messages: Array<{ id: string; content: string; role: string }>;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const data = useLoaderData<typeof loader>();
  const user = useOptionalUser();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const scrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100); // 100ms debounce
  }, []);

  useEffect(() => {
    scrollToBottom();

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages, data.project.messages, scrollToBottom]);

  // If there's only one message, don't display it
  const shouldShowMessages = data.project.messages.length > 1;

  return (
    <div className="flex size-max w-[30%] flex-col gap-4 px-12 pt-4">
      {shouldShowMessages && data.project.messages.map((message) => (
        <Message
          key={message.id}
          message={{
            id: message.id,
            content: message.contents,
            role: message.type === "USER" ? "user" : "assistant",
          }}
        />
      ))}
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function Message({
  message,
}: {
  message: { id: string; content: string; role: string };
}) {
  const user = useOptionalUser();

  return (
    <div className="rounded-lg bg-[#1F2122] p-6 pb-1 pt-5 text-white">
      <div className="flex items-start gap-3">
        {message.role === "user" && user && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700 text-sm font-medium text-white">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.givenName || "User"}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{(user.givenName?.[0] || "U").toUpperCase()}</span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <MarkdownRenderer markdown={message.content} />
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Error) {
    return <div>An unexpected error occurred: {error.message}</div>;
  }

  if (!isRouteErrorResponse(error)) {
    return <h1>Unknown Error</h1>;
  }

  if (error.status === 404) {
    return <div>Project not found</div>;
  }

  return <div>An unexpected error occurred: {error.statusText}</div>;
}
