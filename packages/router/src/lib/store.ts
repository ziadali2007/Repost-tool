import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap, // Import SignalDataTypeMap
  proto, // Import proto for specific types like AppStateSyncKeyData
} from "baileys";
import { db } from "../db";
// Import authKeysTable and necessary drizzle functions
import { authCredsTable, authKeysTable } from "../db/schema";
import { eq, and } from "drizzle-orm"; // Removed sql import if not used
import logger from "./logger"; // Import the shared logger

// Helper function to read data (get)
const readKey = async <T extends keyof SignalDataTypeMap>(
  clientId: string,
  type: T,
  id: string,
): Promise<SignalDataTypeMap[T] | null> => {
  const result = await db
    .select({ data: authKeysTable.data })
    .from(authKeysTable)
    .where(
      and(
        eq(authKeysTable.clientId, clientId),
        eq(authKeysTable.keyType, type),
        eq(authKeysTable.keyId, id),
      ),
    )
    .get();

  if (result) {
    let value = JSON.parse(result.data, BufferJSON.reviver);
    // Handle specific type deserialization if necessary
    if (type === "app-state-sync-key" && value) {
      value = proto.Message.AppStateSyncKeyData.fromObject(value);
    }
    return value as SignalDataTypeMap[T];
  }
  return null;
};

// Helper function to write data (set/update) - uses upsert
const writeKey = async (
  clientId: string,
  type: string,
  id: string,
  value: any,
): Promise<void> => {
  const serializedData = JSON.stringify(value, BufferJSON.replacer);
  await db
    .insert(authKeysTable)
    .values({
      clientId,
      keyType: type,
      keyId: id,
      data: serializedData,
    })
    .onConflictDoUpdate({
      target: [
        authKeysTable.clientId,
        authKeysTable.keyType,
        authKeysTable.keyId,
      ],
      set: { data: serializedData },
    });
};

// Helper function to remove data (delete)
const removeKey = async (
  clientId: string,
  type: string,
  id: string,
): Promise<void> => {
  await db
    .delete(authKeysTable)
    .where(
      and(
        eq(authKeysTable.clientId, clientId),
        eq(authKeysTable.keyType, type),
        eq(authKeysTable.keyId, id),
      ),
    );
};

export const useDBAuthState = async (
  clientId: string,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> => {
  // Select only the data column for creds
  const credsResult = await db
    .select({ data: authCredsTable.data })
    .from(authCredsTable)
    .where(eq(authCredsTable.clientId, clientId))
    .get();

  let creds: AuthenticationCreds;
  if (credsResult) {
    try {
      creds = JSON.parse(
        credsResult.data,
        BufferJSON.reviver,
      ) as AuthenticationCreds;
    } catch (e) {
      logger.error(
        { err: e, clientId },
        "Failed to parse creds JSON, initializing new creds",
      );
      creds = initAuthCreds();
    }
  } else {
    logger.info(
      `No existing creds found for ${clientId}, initializing new creds.`,
    );
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      // Add the keys object with get and set methods
      keys: {
        get: async (type, ids) => {
          const data: { [_: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              const value = await readKey(clientId, type, id);
              logger.debug(
                { type, id, hasValue: !!value },
                `GET KEY ${clientId}`,
              );
              if (value) {
                data[id] = value;
              }
            }),
          );
          return data;
        },
        set: async (data: any) => {
          logger.debug(
            { categories: Object.keys(data) },
            `SET KEY DATA ${clientId}`,
          );
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const type = category as keyof SignalDataTypeMap;
              logger.debug(
                { type, id, hasValue: !!value },
                `SET KEY ${clientId}`,
              );
              if (value) {
                tasks.push(writeKey(clientId, type, id, value));
              } else {
                // If value is null/undefined, remove the key
                logger.debug({ type, id }, `REMOVE KEY ${clientId}`);
                tasks.push(removeKey(clientId, type, id)); // Use removeKey here
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      const serializedCreds = JSON.stringify(creds, BufferJSON.replacer);
      // Use upsert logic for saving creds
      try {
        await db
          .insert(authCredsTable)
          .values({
            clientId,
            data: serializedCreds,
          })
          .onConflictDoUpdate({
            target: authCredsTable.clientId, // Requires clientId to be UNIQUE in schema
            set: { data: serializedCreds },
          });
        logger.debug(`Saved creds for ${clientId}`);
      } catch (error) {
        logger.error({ err: error, clientId }, "Failed to save creds");
      }
    },
  };
};
