import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  messagingLists,
  messagingListMembers,
  MessagingListInsert,
  MessagingListMemberInsert,
} from "../db/schema";
import { t } from "../trpc";
import logger from "../lib/logger";

export const messagingListRouter = t.router({
  // CREATE
  createList: t.procedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        members: z.array(
          z.object({
            remoteJid: z.string(),
            name: z.string(), // Pass chat name from frontend
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.clientId) {
        throw new Error("Client ID is required");
      }
      const { name, description, members } = input;
      const clientId = ctx.clientId;
      // TODO: Get ownerNumber - maybe from socket connection details if available?
      // For now, using clientId as a placeholder. Adjust as needed.
      const ownerNumber = clientId;

      logger.info(
        `Creating messaging list "${name}" for client ${clientId} with ${members.length} members`,
      );

      const newList = await db.transaction(async (tx) => {
        const [insertedList] = await tx
          .insert(messagingLists)
          .values({
            clientId,
            name,
            description,
            ownerNumber,
          })
          .returning();

        if (!insertedList || members.length === 0) {
          return insertedList;
        }

        const memberValues: MessagingListMemberInsert[] = members.map(
          (member) => ({
            clientId,
            listId: insertedList.id,
            remoteJid: member.remoteJid,
            name: member.name,
          }),
        );

        await tx.insert(messagingListMembers).values(memberValues);
        return insertedList;
      });

      logger.info(
        `Successfully created messaging list ID ${newList.id} for client ${clientId}`,
      );
      return newList;
    }),

  // READ ALL
  getLists: t.procedure.query(async ({ ctx }) => {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    logger.debug(`Fetching messaging lists for client ${ctx.clientId}`);
    return db
      .select()
      .from(messagingLists)
      .where(eq(messagingLists.clientId, ctx.clientId))
      .orderBy(messagingLists.name);
  }),

  // READ ONE (with members)
  getListDetails: t.procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.clientId) {
        throw new Error("Client ID is required");
      }
      logger.debug(
        `Fetching details for messaging list ID ${input.id} for client ${ctx.clientId}`,
      );
      const list = await db
        .select()
        .from(messagingLists)
        .where(
          and(
            eq(messagingLists.id, input.id),
            eq(messagingLists.clientId, ctx.clientId),
          ),
        )
        .get();

      if (!list) {
        throw new Error("List not found");
      }

      const members = await db
        .select()
        .from(messagingListMembers)
        .where(eq(messagingListMembers.listId, input.id));

      return { ...list, members };
    }),

  // UPDATE
  updateList: t.procedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        members: z.array(
          z.object({
            remoteJid: z.string(),
            name: z.string(),
          }),
        ), // Send the full list of members for replacement
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.clientId) {
        throw new Error("Client ID is required");
      }
      const { id, name, description, members } = input;
      const clientId = ctx.clientId;

      logger.info(
        `Updating messaging list ID ${id} for client ${clientId} with ${members.length} members`,
      );

      const updatedList = await db.transaction(async (tx) => {
        // 1. Update list details if provided
        const updateData: Partial<MessagingListInsert> = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description; // Allow setting empty description

        const [updated] = await tx
          .update(messagingLists)
          .set(updateData)
          .where(
            and(
              eq(messagingLists.id, id),
              eq(messagingLists.clientId, clientId),
            ),
          )
          .returning();

        if (!updated) {
          throw new Error("List not found or not authorized to update");
        }

        // 2. Delete existing members
        await tx
          .delete(messagingListMembers)
          .where(eq(messagingListMembers.listId, id));

        // 3. Insert new members if any
        if (members.length > 0) {
          const memberValues: MessagingListMemberInsert[] = members.map(
            (member) => ({
              clientId,
              listId: id,
              remoteJid: member.remoteJid,
              name: member.name,
            }),
          );
          await tx.insert(messagingListMembers).values(memberValues);
        }

        return updated;
      });

      logger.info(
        `Successfully updated messaging list ID ${id} for client ${clientId}`,
      );
      return updatedList;
    }),

  // DELETE
  deleteList: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.clientId) {
        throw new Error("Client ID is required");
      }
      const { id } = input;
      const clientId = ctx.clientId;

      logger.info(`Deleting messaging list ID ${id} for client ${clientId}`);

      // Use transaction although cascade delete should handle members
      const result = await db.transaction(async (tx) => {
        // Cascade delete should handle members due to schema definition
        const [deletedList] = await tx
          .delete(messagingLists)
          .where(
            and(
              eq(messagingLists.id, id),
              eq(messagingLists.clientId, clientId),
            ),
          )
          .returning();

        if (!deletedList) {
          throw new Error("List not found or not authorized to delete");
        }
        return deletedList;
      });

      logger.info(
        `Successfully deleted messaging list ID ${id} for client ${clientId}`,
      );
      return { success: true, deletedId: result.id };
    }),
});

export type MessagingListRouter = typeof messagingListRouter;
