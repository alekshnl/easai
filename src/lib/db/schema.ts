import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  workspaceFolder: text("workspace_folder").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // 'openai'
  authType: text("auth_type").notNull(), // 'oauth' | 'api_key'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  apiKey: text("api_key"),
  planType: text("plan_type"),
  tokenExpiresAt: integer("token_expires_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("New Chat"),
  projectId: text("project_id"),
  accountId: text("account_id"),
  model: text("model"),
  reasoningEffort: text("reasoning_effort").default("medium"),
  workspaceFolder: text("workspace_folder"),
  archived: integer("archived").default(0),
  messageCount: integer("message_count").default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  model: text("model"),
  accountId: text("account_id"),
  metadata: text("metadata").default("{}"),
  createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  accountId: text("account_id").notNull(),
  model: text("model").notNull(),
  reasoningEffort: text("reasoning_effort").notNull().default("medium"),
  mode: text("mode").notNull().default("build"),
  status: text("status").notNull().default("pending"),
  userMessageId: text("user_message_id").notNull(),
  assistantMessageId: text("assistant_message_id").notNull(),
  historySnapshot: text("history_snapshot").notNull(),
  cancelRequestedAt: integer("cancel_requested_at"),
  queuedAt: integer("queued_at").notNull(),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
  failedAt: integer("failed_at"),
  cancelledAt: integer("cancelled_at"),
  error: text("error"),
  updatedAt: integer("updated_at").notNull(),
});

export const jobEvents = sqliteTable("job_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  sessionId: text("session_id").notNull(),
  messageId: text("message_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobEvent = typeof jobEvents.$inferSelect;
export type NewJobEvent = typeof jobEvents.$inferInsert;

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type JobMode = "plan" | "build";
