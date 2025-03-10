import type { Project, Message } from "@prisma/client";

import { prisma } from "~/db.server";

export function getMessage({
  id,
  projectId,
}: Pick<Message, "id" | "projectId"> & {
  userId: Message["id"];
}) {
  return prisma.message.findFirst({
    select: { id: true, contents: true },
    where: { id, projectId },
  });
}

export function getMessageListItems({
  projectId,
}: {
  projectId: Project["id"];
}) {
  return prisma.message.findMany({
    where: { projectId },
    select: { id: true, contents: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function createMessage({
  contents,
  projectId,
}: Pick<Message, "contents" | "projectId"> & {
  userId: Message["id"];
}) {
  return prisma.message.create({
    data: {
      contents,
      project: {
        connect: {
          id: projectId,
        },
      },
    },
  });
}

export function deleteMessage({
  id,
  projectId,
}: Pick<Message, "id"> & { projectId: Project["id"] }) {
  return prisma.message.deleteMany({
    where: { id, projectId },
  });
}
