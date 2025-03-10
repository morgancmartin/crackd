import type { LoaderFunctionArgs, HeadersFunction, ActionFunctionArgs } from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import invariant from "tiny-invariant";
import type { Message as ProjectMessage, User } from "@prisma/client";
import { getProject, updateProjectTitle } from "~/models/project.server";
import { requireUserId } from "~/session.server";
import MarkdownRenderer from "~/components/markdownRenderer";
import { useOptionalUser } from "~/utils";
import { useProject } from "~/hooks/useProject";
import { AppDisplay } from "~/components/AppDisplay";
import { ProjectTitle } from "~/components/ProjectTitle";

export const headers: HeadersFunction = () => ({
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.projectId, "projectId not found");

  const formData = await request.formData();
  const title = formData.get("title");

  if (typeof title !== "string") {
    return { error: "Title must be a string" };
  }

  const project = await updateProjectTitle({
    id: params.projectId,
    userId,
    title,
  });

  return { project };
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
  const { project, files, isConnected } = useProject(data.project, user as User);

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
      <ProjectTitle title={project.title} />
      <div className="relative flex h-full w-full flex-1 overflow-y-scroll pb-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#171717] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
        <Messages messages={project.messages} user={user as User} />
        <div className="fixed bottom-0 left-0 h-40 w-[30%] flex-col justify-center gap-0 px-12">
          <div className="h-[85%] w-full bg-transparent">
            <textarea
              placeholder="How can Crackd help you today?"
              className="h-full w-full resize-none rounded-lg border border-gray-700 bg-[#171717cc] bg-opacity-90 p-4 text-sm text-white backdrop-blur-md focus:outline-none"
            ></textarea>
          </div>
          <div className="h-[15%] w-full bg-black"></div>
        </div>
        <div className="fixed right-0 flex h-[888px] w-[70%] items-end justify-end overflow-y-hidden pb-4 pr-4">
          <AppDisplay files={files} />
        </div>
      </div>
    </div>
  );
}

function Messages({
  messages,
  user,
}: {
  messages: Array<Pick<ProjectMessage, "id" | "contents" | "type">>;
  user: User;
}) {
  return (
    <div className="flex size-max w-[30%] flex-col gap-4 px-12 pt-4">
      {messages.map((message) => (
        <Message key={message.id} message={message} user={user} />
      ))}
    </div>
  );
}

function Message({
  message,
  user,
}: {
  message: Pick<ProjectMessage, "id" | "contents" | "type">;
  user: User;
}) {
  return (
    <div className="rounded-lg bg-[#1F2122] p-4 text-white">
      <div className="flex items-start gap-3">
        {message.type === "USER" && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white overflow-hidden">
            {user.picture ? (
              <img src={user.picture} alt={user.givenName || 'User'} className="h-full w-full object-cover" />
            ) : (
              <span>{(user.givenName?.[0] || 'U').toUpperCase()}</span>
            )}
          </div>
        )}
        <span className="flex-1">
          <MarkdownRenderer markdown={message.contents} />
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
