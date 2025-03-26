import type { LoaderFunctionArgs, HeadersFunction, ActionFunctionArgs } from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useSubmit,
  Link,
  useParams,
} from "@remix-run/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import type { User } from "@prisma/client";
import { PiExportBold, PiCloudArrowUpBold, PiRocketLaunchBold } from "react-icons/pi";
import { getProject, updateProjectTitle } from "~/models/project.server";
import { requireUserId } from "~/session.server";
import MarkdownRenderer from "~/components/markdownRenderer";
import { useOptionalUser } from "~/utils";
import { useProject } from "~/hooks/useProject";
import { AppDisplay } from "~/components/AppDisplay";
import { ProjectTitle } from "~/components/ProjectTitle";
import { Button } from "~/components/ui/button";
import { useChat } from "@ai-sdk/react";

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
  const { project, files, isConnected } = useProject(data.project, user as User);
  const params = useParams();
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
    onFinish: (message) => {
      // Handle any post-message actions if needed
    },
    body: {
      projectId: params.projectId,
    },
  });

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
      <div className="grid grid-cols-3 items-center px-12 border-b border-gray-800">
        <div className="col-start-1">
          <Link to="/" reloadDocument className="text-white text-xl font-bold hover:text-gray-300 transition-colors">
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
        className="relative flex flex-col h-full w-full flex-1 overflow-y-scroll pb-4 pb-48 scrollbar-thin scrollbar-track-[#171717] scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full scrollbar-thumb:bg-gray-400 scrollbar-hover:bg-gray-300"
        style={{ scrollbarWidth: 'auto' }}
      >
        <Messages messages={messages} />
        <div className="fixed bottom-0 left-0 h-40 w-[30%] flex-col justify-center gap-0 px-12">
          <div className="h-[85%] w-full bg-transparent">
            <form onSubmit={handleSubmit} className="h-full w-full">
              <textarea
                value={input}
                onChange={handleInputChange}
                name="contents"
                placeholder="How can Crackd help you today?"
                className="resize-none rounded-lg border border-gray-700 bg-[#171717cc] bg-opacity-90 p-4 text-sm text-white backdrop-blur-md focus:outline-none h-full w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const form = new FormData();
                    form.append("contents", e.currentTarget.value);
                    form.append("projectId", params.projectId || "");
                    // submit(form, { method: "post" });
                    handleSubmit(e);
                  }
                }}
              ></textarea>
            </form>
          </div>
          <div className="h-[15%] w-full bg-black"></div>
        </div>
        <div className="fixed right-0 flex h-[888px] w-[70%] items-end justify-end overflow-y-hidden pb-4 mr-4">
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, data.project.messages]);

  return (
    <div className="flex size-max w-[30%] flex-col gap-4 px-12 pt-4">
      {data.project.messages.map((message) => (
        <Message 
          key={message.id} 
          message={{
            id: message.id,
            content: message.contents,
            role: message.type === "USER" ? "user" : "assistant"
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
    <div className="rounded-lg bg-[#1F2122] p-6 py-5 text-white">
      <div className="flex items-start gap-3">
        {message.role === "user" && user && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white overflow-hidden shrink-0">
            {user.picture ? (
              <img src={user.picture} alt={user.givenName || 'User'} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <span>{(user.givenName?.[0] || 'U').toUpperCase()}</span>
            )}
          </div>
        )}
        <span className="flex-1 py-1">
          <MarkdownRenderer markdown={message.content} />
        </span>
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
