import { prisma } from "@/lib/prisma";

export async function logEvent(params: {
  groupId: string;
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
}) {
  await prisma.activityEvent.create({
    data: {
      groupId: params.groupId,
      actorId: params.actorId,
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
